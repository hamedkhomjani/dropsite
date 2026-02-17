# DropLab

DropLab is a secure and simple file sharing platform designed for quick, hassle-free transfers. Upload your files, get a link, and share it. Files are automatically deleted after 3 days to ensure privacy and keep the server clean.

## Features

- **Instant Sharing**: Drag and drop files to upload immediately.
- **Secure**: No registration required. Files are stored securely.
- **Privacy First**: Automatic deletion of files after 3 days.
- **Multi-language Support**: Available in English, Swedish, and Persian (Farsi).
- **Responsive Design**: Modern, tech-inspired UI that works on all devices.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/dropsite.git
    cd dropsite
    ```

2.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # macOS/Linux
    source .venv/bin/activate
    ```

3.  Install dependencies:
    ```bash
    pip install flask
    ```

4.  Run the application:
    ```bash
    python app.py
    ```

5.  Open your browser and navigate to `http://localhost:5000`.

## Usage

1.  **Upload**: Click the upload area or drag and drop a file.
2.  **Share**: Copy the generated link and send it to the recipient.
3.  **Download**: The recipient opens the link and clicks "Download".

## Technologies

- **Backend**: Python (Flask)
- **Frontend**: HTML5, CSS3, JavaScript
- **Styling**: Custom CSS with a cyberpunk aesthetic

## License

This project is open source and available under the MIT License.
