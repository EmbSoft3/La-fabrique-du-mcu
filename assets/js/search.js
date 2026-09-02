(function () {
   'use strict';

   const DEBOUNCE_MS = 120;
   const MAX_RESULTS = 10;

   /** Normalise une chaîne pour une comparaison insensible à la casse et aux accents. */
   function normalize(str) {
      return str
         .normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '')
         .toLowerCase()
         .trim();
   }

   /**
    * Vérifie qu'un lien d'index est une ancre/URL relative attendue, jamais
    * un schéma exécutable (javascript:, data:...). 
    */
   function isSafeAnchor(anchor) {
      if (typeof anchor !== 'string' || anchor.trim() === '') {
         return false;
      }
      // Rejette tout schéma d'URI explicite (javascript:, data:, http:, etc.).
      // N'autorise que des liens relatifs à ton site : "#...", "page.html#...",
      // "./page.html", "../page.html".
      return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(anchor.trim());
   }

   /** Crée un élément DOM avec des attributs et du texte. */
   function el(tag, attrs, text) {
      const node = document.createElement(tag);
      if (attrs) {
         for (const key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
               node.setAttribute(key, attrs[key]);
            }
         }
      }
      if (text !== undefined && text !== null && text !== '') {
         node.textContent = text;
      }
      return node;
   }

   class MkApiSearch {
      constructor(container) {
         this.container = container;
         this.indexUrl = container.dataset.indexUrl || 'search-index.json';
         this.data = [];
         this.results = [];
         this.activeIndex = -1;
         this.debounceTimer = null;

         // Textes d'interface configurables par page (permettre une version anglaise ou autre langue).
         this.i18n = {
            placeholder: container.dataset.placeholder || 'Rechercher une fonction (ex : mk_display_stream)…',
            emptyText: container.dataset.emptyText || 'Aucune fonction trouvée.',
            resultsText: container.dataset.resultsText || '{count} résultat(s). Plusieurs pages possibles pour un même nom : choisissez celle qui vous intéresse.',
            resultsTruncatedText: container.dataset.resultsTruncatedText || '{count} résultat(s) affiché(s) sur {total}. Affinez votre recherche pour voir les autres.',
            indexErrorText: container.dataset.indexErrorText || 'Index de recherche indisponible pour le moment.'
         };

         this._buildDom();
         this._bindEvents();
         this._loadIndex();
      }

      _buildDom() {
         this.container.classList.add('mk-api-search');

         this.input = el('input', {
            type: 'text',
            role: 'combobox',
            'aria-expanded': 'false',
            'aria-autocomplete': 'list',
            'aria-controls': 'mk-api-search-listbox',
            autocomplete: 'off',
            spellcheck: 'false',
            placeholder: this.i18n.placeholder
         });

         this.listbox = el('ul', {
            id: 'mk-api-search-listbox',
            role: 'listbox',
            class: 'mk-api-search_listbox'
         });
         this.listbox.hidden = true;

         this.status = el('p', { class: 'mk-api-search_status', 'aria-live': 'polite' });

         this.container.appendChild(this.input);
         this.container.appendChild(this.listbox);
         this.container.appendChild(this.status);
      }

      _bindEvents() {
         this._onInput = () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this._onQueryChange(), DEBOUNCE_MS);
         };
         this._onKeyDownBound = (e) => this._onKeyDown(e);

         this.input.addEventListener('input', this._onInput);
         this.input.addEventListener('keydown', this._onKeyDownBound);

         // Ferme la liste si on clique en dehors du composant. Référence
         // conservée pour pouvoir la retirer proprement dans destroy().
         this._onDocumentClick = (e) => {
            if (!this.container.contains(e.target)) {
               this._closeList();
            }
         };
         document.addEventListener('click', this._onDocumentClick);
      }

      // Nettoyage complet (écouteurs + timer en attente). 
      destroy() {
         clearTimeout(this.debounceTimer);
         document.removeEventListener('click', this._onDocumentClick);
         this.input.removeEventListener('input', this._onInput);
         this.input.removeEventListener('keydown', this._onKeyDownBound);
      }

      async _loadIndex() {
         try {
            // Données collées directement dans la page, dans un
            // <script type="application/json"> à l'intérieur du conteneur.
            const inline = this.container.querySelector('script[type="application/json"]');
            let json;
            if (inline) {
               json = JSON.parse(inline.textContent);
            } else {
               // Chargement via fetch d'un fichier séparé.
               const res = await fetch(this.indexUrl, { credentials: 'same-origin' });
               if (!res.ok) {
                  throw new Error('HTTP ' + res.status);
               }
               json = await res.json();
            }
            this.data = Array.isArray(json.functions) ? json.functions : [];
            // On ignore silencieusement les entrées mal formées (name/anchor
            // absents ou non textuels) plutôt que de faire échouer tout l'index
            // pour une seule faute de frappe dans le JSON édité à la main.
            this.data = this.data
               .filter((fn) => fn && typeof fn.name === 'string' && fn.name.trim() !== '' && isSafeAnchor(fn.anchor))
               .map((fn) => {
                  fn._key = normalize([fn.name, fn.module, fn.submodule].filter(Boolean).join(' '));
                  fn._nameKey = normalize(fn.name);
                  return fn;
               });
         } catch (err) {
            this.status.textContent = this.i18n.indexErrorText;
            console.error('mk-api-search: échec du chargement de l\'index', err);
         }
      }

      _onQueryChange() {
         const raw = this.input.value;
         const query = normalize(raw);

         if (!query) {
            this._closeList();
            return;
         }

         // Simple recherche de sous-chaîne 
         const matches = this.data
            .filter((fn) => fn._key.includes(query))
            .sort((a, b) => {
               // Un nom qui commence par la saisie remonte avant un nom où la
               // correspondance est ailleurs 
               const aStarts = a._nameKey.startsWith(query);
               const bStarts = b._nameKey.startsWith(query);
               if (aStarts && !bStarts) return -1;
               if (!aStarts && bStarts) return 1;
               return 0;
            });

         this.totalMatches = matches.length;
         this.results = matches.slice(0, MAX_RESULTS);

         this._renderList();
      }

      _renderList() {
         while (this.listbox.firstChild) {
            this.listbox.removeChild(this.listbox.firstChild);
         }
         this.activeIndex = -1;

         if (this.results.length === 0) {
            this.listbox.hidden = true;
            this.input.setAttribute('aria-expanded', 'false');
            this.status.textContent = this.i18n.emptyText;
            return;
         }

         this.results.forEach((fn, i) => {
            const li = el('li', {
               role: 'option',
               id: 'mk-api-search-opt-' + i,
               class: 'mk-api-search_option'
            });

            const line = el('div', { class: 'mk-api-search_option-line' });
            line.appendChild(el('span', { class: 'mk-api-search_option-name' }, fn.name));
            const meta = [fn.module, fn.submodule].filter(Boolean).join(' / ');
            if (meta) {
               line.appendChild(el('span', { class: 'mk-api-search_option-module' }, meta));
            }
            li.appendChild(line);

            if (fn.description) {
               li.appendChild(el('span', { class: 'mk-api-search_option-desc' }, fn.description));
            }

            li.addEventListener('mousedown', (e) => {
               // mousedown plutôt que click : évite la perte de focus avant la sélection.
               e.preventDefault();
               this._goTo(fn);
            });

            this.listbox.appendChild(li);
         });

         this.listbox.hidden = false;
         this.input.setAttribute('aria-expanded', 'true');
         this.status.textContent = this.totalMatches > this.results.length
            ? this.i18n.resultsTruncatedText.replace('{count}', this.results.length).replace('{total}', this.totalMatches)
            : this.i18n.resultsText.replace('{count}', this.results.length);
      }

      _onKeyDown(e) {
         if (this.listbox.hidden) {
            return;
         }
         const items = this.listbox.querySelectorAll('.mk-api-search_option');
         if (items.length === 0) return;

         switch (e.key) {
            case 'ArrowDown':
               e.preventDefault();
               this.activeIndex = (this.activeIndex + 1) % items.length;
               this._setActive(items);
               break;
            case 'ArrowUp':
               e.preventDefault();
               this.activeIndex = (this.activeIndex - 1 + items.length) % items.length;
               this._setActive(items);
               break;
            case 'Enter':
               if (this.activeIndex >= 0 && this.results[this.activeIndex]) {
                  e.preventDefault();
                  this._goTo(this.results[this.activeIndex]);
               }
               break;
            case 'Escape':
               this._closeList();
               break;
         }
      }

      _setActive(items) {
         items.forEach((item, i) => {
            item.classList.toggle('is-active', i === this.activeIndex);
         });
         const active = items[this.activeIndex];
         if (active) {
            this.input.setAttribute('aria-activedescendant', active.id);
            active.scrollIntoView({ block: 'nearest' });
         } else {
            this.input.removeAttribute('aria-activedescendant');
         }
      }

      /** Navigue vers la page de doc correspondant à l'entrée choisie. */
      _goTo(fn) {
         if (!fn || !fn.anchor) {
            return;
         }
         window.location.href = fn.anchor;
      }

      _closeList() {
         this.listbox.hidden = true;
         this.input.setAttribute('aria-expanded', 'false');
         this.input.removeAttribute('aria-activedescendant');
         this.activeIndex = -1;
      }
   }

   window.MkApiSearch = {
      init(container) {
         if (!container) {
            console.error('mk-api-search: conteneur introuvable.');
            return null;
         }
         return new MkApiSearch(container);
      }
   };
})();