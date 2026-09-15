from fontTools import subset

source_font_path = r"C:\Users\mrenard\Downloads\Noto_Color_Emoji\NotoColorEmoji-Regular.ttf"   # adapte le nom exact du fichier téléchargé
destination_font_path = r"C:\Users\mrenard\Downloads\Noto_Color_Emoji\NotoColorEmoji-Regular.woff2"

# Colle directement les emojis utilisés sur le site (avec leurs variation selectors ✒️)
emoji_text = "✔⚠️📌🌐❔⚡🔍⚙️🖥️😎🙈😇😱😭😅🫣😉😶😬🤐🤔😶😳🤓😒😮‍💨😌😊😍🥰👍👌🙏🌼🐑🚀🔨🪚🗝️👑↗️↘️⛓⛓️‍💥🚧💥💬"

args = [
    source_font_path,
    f"--output-file={destination_font_path}",
    f"--text={emoji_text}",
    "--flavor=woff2",
    "--layout-features=*",   # conserve les substitutions nécessaires aux séquences multi-codepoints (ex. ⚠️)
]

subset.main(args)