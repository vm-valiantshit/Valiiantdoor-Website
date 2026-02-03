# Valiantdoor Website

Professional business website for Valiantdoor.com - Your trusted partner for door installation and home remodeling services.

## 📋 Overview

This is a fully responsive, professional business website featuring:
- Modern, clean design
- Mobile-friendly navigation
- Service pages with detailed information
- Contact form for customer inquiries
- About page highlighting company values

## 🚀 Quick Start

### Viewing the Website

Simply open `index.html` in your web browser to view the website locally.

```bash
# On Linux/Mac
open index.html

# On Windows
start index.html
```

### File Structure

```
.
├── index.html          # Homepage
├── services.html       # Services page
├── about.html          # About us page
├── contact.html        # Contact page
├── css/
│   └── style.css       # Main stylesheet
├── js/
│   └── script.js       # JavaScript functionality
├── download-from-url.sh # Utility script for downloading files
└── README.md           # This file
```

## 🔄 Restoring Files from URL

If you need to restore or download website files from a backup URL, use the provided utility script:

```bash
# Basic usage
./download-from-url.sh <URL>

# Download to specific directory
./download-from-url.sh <URL> ./backup

# Example: Download from a backup ZIP
./download-from-url.sh https://example.com/website-backup.zip

# Example: Download from a TAR.GZ archive
./download-from-url.sh https://example.com/website-backup.tar.gz ./restore
```

The script will:
1. Download the file from the provided URL
2. Automatically detect and extract archives (ZIP, TAR, TAR.GZ)
3. Place the files in the specified destination
4. Optionally clean up archive files after extraction

### Supported Formats
- ZIP archives
- TAR archives
- TAR.GZ/TGZ archives
- Individual files (HTML, CSS, JS, images, etc.)

## 🌐 Deployment

### GitHub Pages

1. Go to your repository settings
2. Navigate to "Pages" section
3. Select the branch to deploy (usually `main`)
4. Click "Save"
5. Your site will be available at `https://yourusername.github.io/repository-name/`

### Other Hosting Services

Upload all files to your hosting provider via:
- FTP/SFTP
- cPanel File Manager
- Git deployment
- Hosting provider's dashboard

## ✨ Features

### Pages
- **Home**: Welcome page with service overview and call-to-action
- **Services**: Detailed information about all services offered
- **About**: Company story, values, and process
- **Contact**: Contact form and business information

### Design Features
- Responsive layout (mobile, tablet, desktop)
- Modern gradient headers
- Interactive navigation
- Service cards with hover effects
- Professional color scheme
- Smooth scrolling
- Mobile hamburger menu

## 🛠️ Customization

### Changing Colors

Edit `css/style.css` and modify the color variables:
- Primary color: `#3498db`
- Secondary color: `#2c3e50`
- Accent color: `#667eea`

### Updating Content

1. **Company Information**: Edit the text in each HTML file
2. **Contact Details**: Update phone, email, and address in all pages
3. **Services**: Modify `services.html` to reflect your offerings
4. **Navigation**: Edit the nav menu in each HTML file

### Adding Images

1. Create an `images/` directory
2. Add your images
3. Update HTML to reference your images:
   ```html
   <img src="images/your-image.jpg" alt="Description">
   ```

## 📱 Browser Support

The website is compatible with:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🐛 Troubleshooting

### Form Submission Not Working

The contact form currently logs data to console. To enable actual email sending, you'll need to:
1. Set up a backend service (Node.js, PHP, etc.)
2. Or use a form service like Formspree, Netlify Forms, or EmailJS
3. Update the form handler in `js/script.js`

### Mobile Menu Not Opening

Ensure JavaScript is enabled in your browser and `js/script.js` is properly linked.

## 📄 License

This website is part of the Valiantdoor business. All rights reserved.

## 📞 Support

For questions or issues, please contact:
- Email: info@valiantdoor.com
- Phone: (555) 123-4567
