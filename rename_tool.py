import os

target_dir = r"c:\Users\soudf\OneDrive\Desktop\soud movies\SoudMusic"

def replace_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'soudmusic' in content.lower():
            new_content = content.replace('SoudMusic', 'SoudMusic')
            new_content = new_content.replace('soudmusic', 'soudmusic')
            new_content = new_content.replace('SOUDMUSIC', 'SOUDMUSIC')
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {filepath}")
    except Exception as e:
        print(f"Skipped {filepath}: {e}")

for root, dirs, files in os.walk(target_dir):
    # Skip .git and node_modules
    if '.git' in dirs:
        dirs.remove('.git')
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
        
    for file in files:
        if file.endswith('.png') or file.endswith('.jpg') or file.endswith('.svg') or file.endswith('.ico'):
            continue # skip binaries
        filepath = os.path.join(root, file)
        replace_in_file(filepath)
