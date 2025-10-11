# 3D Printing Service - WordPress Integration

This document provides instructions on how to integrate the 3D printing React application into your WordPress website.

## Files

This project includes the following files for WordPress integration:

- `dist/`: This directory contains the built static files (HTML, CSS, JavaScript) of the React application.
- `react-wordpress-integration.php`: This is a WordPress plugin that creates a shortcode to embed the React app.

## Integration Steps

1. **Place the Files in Your WordPress Installation:**
   - Create a new folder named `react-app` inside your WordPress `wp-content/plugins/` directory.
   - Copy the `dist/` directory and the `react-wordpress-integration.php` file into this new `react-app` folder.

2. **Activate the Plugin:**
   - Log in to your WordPress admin dashboard.
   - Go to **Plugins > Installed Plugins**.
   - Find "React WordPress Integration" in the list and click **Activate**.

3. **Embed the App on a Page:**
   - Create a new page or edit an existing one where you want to display the 3D printing app.
   - In the page editor, add a new Shortcode block.
   - Enter the following shortcode into the block: `[react_app]`
   - Save or publish the page.

4. **Verify the Integration:**
   - View the page on your live site. The 3D printing application should now be displayed.
   - The app will automatically use the logged-in WordPress user's information for authentication.

## How It Works

- The `react-wordpress-integration.php` file defines a shortcode `[react_app]` that loads the necessary CSS and JavaScript files from the `dist/` directory.
- It also passes the current WordPress user's data (ID and email) to the React application via the `window.wordpressUser` JavaScript object.
- The React app's `useAuth` hook has been modified to read this `window.wordpressUser` object, creating a seamless authentication experience between WordPress and the React app.