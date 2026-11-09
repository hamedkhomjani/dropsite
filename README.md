# DropLab

DropLab is a secure and simple file sharing platform designed for quick, hassle-free transfers. Upload your files, get a link, and share it. Files are automatically deleted after 3 days to ensure privacy and keep the server clean.

## Features

- **Instant Sharing**: Drag and drop files to upload immediately.
- **Secure**: No registration required. Files are stored securely.
- **Privacy First**: Automatic deletion of files after 3 days.
- **Multi-language Support**: Available in English, Swedish, and Persian (Farsi).
- **Responsive Design**: Modern, tech-inspired UI that works on all devices.

## Running locally

DropLab runs on Netlify: pages are rendered by a Netlify Function, uploaded files are stored in Netlify Blobs, and a scheduled function deletes files older than 3 days.

1.  Clone the repository and install dependencies:
    ```bash
    git clone https://github.com/hamedkhomjani/dropsite.git
    cd dropsite
    npm install
    ```

2.  Start the local Netlify environment:
    ```bash
    npx netlify dev
    ```

Uploads are limited to 5 MB per file (Netlify Functions accept request bodies of about 6 MB).

## Usage

1.  **Upload**: Click the upload area or drag and drop a file.
2.  **Share**: Copy the generated link and send it to the recipient.
3.  **Download**: The recipient opens the link and clicks "Download".

## Technologies

- **Backend**: Netlify Functions (TypeScript) with Nunjucks templates
- **Storage**: Netlify Blobs
- **Frontend**: HTML5, CSS3, JavaScript
- **Styling**: Custom CSS with a cyberpunk aesthetic

## License

This project is open source and available under the MIT License.
