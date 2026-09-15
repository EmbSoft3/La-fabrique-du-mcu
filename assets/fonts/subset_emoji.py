from fontTools import subset

source_font_path = "./NotoColorEmoji-Regular.ttf"  
destination_font_path = "./NotoColorEmoji-Regular.woff2"

# Emojis utilisés sur le site
emoji_text = "✔⚠️📌🌐❔⚡🔍⚙️🖥️😎🙈😇😱😭😅🫣😉😶😬🤐🤔😶😳🤓😒😮‍💨😌😊😍🥰👍👌🙏🌼🐑🚀🔨🪚🗝️👑↗️↘️⛓⛓️‍💥🚧💥💬"

args = [
    source_font_path,
    f"--output-file={destination_font_path}",
    f"--text={emoji_text}",
    "--flavor=woff2",
    "--layout-features=*",  
]

subset.main(args)