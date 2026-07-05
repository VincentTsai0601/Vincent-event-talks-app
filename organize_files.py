import os
import shutil

def organize_files():
    # Target directories
    dirs = {
        'Images': ['.jpg', '.jpeg', '.gif'],
        'Documents': ['.txt'],
        'Videos': ['.mp4']
    }

    # Ensure directories exist
    for folder in dirs.keys():
        if not os.path.exists(folder):
            os.makedirs(folder)
            print(f"Created folder: {folder}")

    # Scan current directory for files
    files = [f for f in os.listdir('.') if os.path.isfile(f)]
    
    moved_count = 0
    for file in files:
        _, ext = os.path.splitext(file)
        ext = ext.lower()
        
        # Check matching folder
        for folder, extensions in dirs.items():
            if ext in extensions:
                dest = os.path.join(folder, file)
                try:
                    shutil.move(file, dest)
                    print(f"Moved: {file} -> {folder}/")
                    moved_count += 1
                except Exception as e:
                    print(f"Error moving {file}: {e}")
                break

    if moved_count == 0:
        print("No matching files found to organize.")
    else:
        print(f"Successfully organized {moved_count} file(s).")

if __name__ == "__main__":
    organize_files()
