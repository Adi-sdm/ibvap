import zipfile
import os

source_dir = r"C:\Users\Adi\.gemini\antigravity\scratch\ibvap"
output_zip = r"C:\Users\Adi\.gemini\antigravity\scratch\ibvap.zip"

exclude_dirs = {".venv", "node_modules", "__pycache__", ".pytest_cache", ".git"}

print(f"Creating zip package: {output_zip}...")
total_files = 0

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(source_dir):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith(('.pyc', '.pyo')):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, os.path.dirname(source_dir))
            zipf.write(full_path, rel_path)
            total_files += 1

size_mb = os.path.getsize(output_zip) / (1024 * 1024)
print(f"Zip created successfully! Total files: {total_files}, Size: {size_mb:.2f} MB")