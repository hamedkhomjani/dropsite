from flask import Flask, request, send_from_directory, redirect, render_template, session, url_for
from werkzeug.utils import secure_filename
import os
import time
import uuid

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'change-this-secret-key')

UPLOAD_FOLDER = 'uploads'
MAX_AGE = 3 * 24 * 60 * 60  # 3 روز به ثانیه
UPLOAD_DURATION = MAX_AGE
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB

temporary_links = {}  # file_id : filename
file_timestamps = {}  # file_id : timestamp

# لیست پسوندهای غیرمجاز (فایل‌های اجرایی و خطرناک)
FORBIDDEN_EXTENSIONS = {'exe', 'bat', 'cmd', 'sh', 'vbs', 'ps1', 'msi', 'jar', 'scr', 'com', 'pif'}

def is_allowed_file(filename):
    """بررسی می‌کند که آیا پسوند فایل مجاز است یا خیر"""
    if '.' in filename:
        ext = filename.rsplit('.', 1)[1].lower()
        if ext in FORBIDDEN_EXTENSIONS:
            return False
    return True

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


def get_lang():
    """زبان فعال را از query string یا session برمی‌گرداند."""
    lang = request.args.get("lang")
    if lang in ("fa", "en", "sv"):
        session["lang"] = lang
    return session.get("lang", "fa")



def find_file_by_id(file_id):
    """Searches for a file in UPLOAD_FOLDER that matches the file_id."""
    try:
        if not os.path.exists(UPLOAD_FOLDER):
            return None
        for fname in os.listdir(UPLOAD_FOLDER):
            # Check for new format: name__uuid.ext
            # We look for the ID at the end of the stem
            base_name, _ = os.path.splitext(fname)
            if "__" in base_name:
                parts = base_name.split("__")
                # The ID should be the last part of the filename (before extension)
                if parts[-1] == file_id:
                    return fname
            
            # Legacy/Fallback checks (optional, but keeps existing files working if any)
            if fname.startswith(file_id + "__"):
                return fname
            if base_name == file_id:
                return fname
    except Exception:
        pass
    return None

def cleanup_uploads():
    now = time.time()
    if not os.path.exists(UPLOAD_FOLDER):
        return
        
    for filename in os.listdir(UPLOAD_FOLDER):
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(file_path):
            age = now - os.path.getctime(file_path)
            if age > MAX_AGE:
                try:
                    os.remove(file_path)
                    # Find IDs associated with this filename
                    to_delete = [k for k, v in temporary_links.items() if v == filename]
                    for k in to_delete:
                        temporary_links.pop(k, None)
                        file_timestamps.pop(k, None)
                except Exception as e:
                    print(f"Error cleaning up {filename}: {e}")

from translations import TRANSLATIONS

@app.route('/')
def home():
    cleanup_uploads()
    lang = get_lang()
    return render_template('index.html', lang=lang, t=TRANSLATIONS[lang])

@app.route('/about')
def about():
    lang = get_lang()
    return render_template('about.html', lang=lang, t=TRANSLATIONS[lang])

@app.route('/contact')
def contact():
    lang = get_lang()
    return render_template('contact.html', lang=lang, t=TRANSLATIONS[lang])

@app.route('/privacy')
def privacy():
    lang = get_lang()
    return render_template('privacy.html', lang=lang, t=TRANSLATIONS[lang])

@app.route('/upload', methods=['POST'])
def upload():
    cleanup_uploads()
    # حفظ زبان جاری کاربر
    get_lang()
    file = request.files.get('file')

    if not file or file.filename == '':
        return "No file selected", 400

    if request.content_length and request.content_length > MAX_FILE_SIZE:
        return "File too large", 413

    if not is_allowed_file(file.filename):
        return "File type not allowed (Security Restriction)", 403

    file_id = str(uuid.uuid4())
    
    # Save with name first, then ID: filename__uuid.ext
    # This ensures the filename is readable in the link/storage
    safe_name = secure_filename(file.filename)
    name_root, ext = os.path.splitext(safe_name)
    if not name_root: name_root = "file"
    
    filename = f"{name_root}__{file_id}{ext}"
    
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)

    temporary_links[file_id] = filename
    file_timestamps[file_id] = time.time()

    return redirect(f"/success/{file_id}")

@app.route('/success/<file_id>')
def success(file_id):
    lang = get_lang()
    
    # Try to recover if missing from memory (e.g. after restart)
    if file_id not in temporary_links:
        found_filename = find_file_by_id(file_id)
        if found_filename:
            temporary_links[file_id] = found_filename
            try:
                file_path = os.path.join(UPLOAD_FOLDER, found_filename)
                file_timestamps[file_id] = os.path.getctime(file_path)
            except:
                file_timestamps[file_id] = time.time() # fallback
    
    filename = temporary_links.get(file_id)
    if not filename:
        return redirect(url_for('home', lang=lang))
        
    upload_time = file_timestamps.get(file_id, time.time())

    now = time.time()
    time_left = max(0, int(UPLOAD_DURATION - (now - upload_time)))
    days = time_left // (24*3600)
    hours = (time_left % (24*3600)) // 3600
    minutes = (time_left % 3600) // 60
    seconds = time_left % 60

    link = url_for('download', filename=filename, _external=True)

    return render_template('success.html', link=link,
                           days=days, hours=hours, minutes=minutes, seconds=seconds,
                           lang=lang, t=TRANSLATIONS[lang])

@app.route('/files/<path:filename>')
def download(filename):
    # Default download name
    download_name = filename
    
    # Try to extract the original name from our format: name__uuid.ext
    base, ext = os.path.splitext(filename)
    if "__" in base:
        parts = base.split("__")
        # Reconstruct the original name (everything before the last __)
        if len(parts) >= 2:
            original_part = "__".join(parts[:-1]) # everything except the UUID
            download_name = original_part + ext

    # Add app name as requested: "Drop3_OriginalName.ext"
    # Logic: If we found a clean name, prefix it. If not, prefix the raw filename.
    if not download_name.startswith("DropLab_"):
        download_name = f"DropLab_{download_name}"
            
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True, download_name=download_name)

# دانلود دستی با لینک و کلید
@app.route('/download_manual', methods=['POST'])
def download_manual():
    lang = get_lang()
    file_link = request.form.get('file_link')

    try:
        # Extract filename or ID from the provided link
        # Handle cases like http://host/success/UUID or http://host/files/filename__UUID.ext
        parsed_path = file_link.strip().rstrip('/')
        filename = os.path.basename(parsed_path)
        
        # Check if user provided a link without extension (e.g. success page link)
        root, ext = os.path.splitext(filename)
        if not ext:
            found = find_file_by_id(root)
            if found:
                filename = found
        
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(file_path):
            download_url = url_for('download', filename=filename)
            return render_template('download_manual.html', download_url=download_url, lang=lang, t=TRANSLATIONS[lang])
        else:
            error_msg = TRANSLATIONS.get(lang, TRANSLATIONS['fa']).get('error_file_not_found', 'File not found')
            return render_template('download_manual.html', error=error_msg, lang=lang, t=TRANSLATIONS[lang])
    except Exception as e:
        print(f"Manual download error: {e}")
        error_msg = TRANSLATIONS.get(lang, TRANSLATIONS['fa']).get('error_invalid_link', 'Invalid link')
        return render_template('download_manual.html', error=error_msg, lang=lang, t=TRANSLATIONS[lang])



if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)

