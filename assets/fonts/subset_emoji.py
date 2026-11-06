from fontTools import subset

source_font_path = "./NotoColorEmoji-Regular.ttf"  
destination_font_path = "./NotoColorEmoji-Regular.woff2"

#Pour mettre à jour la police réduite
#pip install fonttools brotli
#py -3 subset_emoji.py

# Emojis utilisés sur le site
emoji_text = "✔✘⚠️📌🌐❔⚡🔍⚙️🖥️😎🙈😇😱😭😅🫣😉😶😬🤐🤔😶😳🤓😒😮‍💨😌😊😍🥰👍👌🙏🌼🐑🚀🔨🪚🗝️👑↗️↘️⛓⛓️‍💥🚧💥💬📩"

args = [
    source_font_path,
    f"--output-file={destination_font_path}",
    f"--text={emoji_text}",
    "--flavor=woff2",
    "--layout-features=*",  
]

subset.main(args)