<?php
/*
Plugin Name: React WordPress Integration
Description: Integrates the 3D printing React app with WordPress.
Version: 1.0
Author: Your Name
*/

function react_app_shortcode() {
    // Get the current logged-in user's data
    $current_user = wp_get_current_user();
    $user_data = null;

    if ($current_user->exists()) {
        $user_data = array(
            'id' => $current_user->ID,
            'email' => $current_user->user_email,
            // Add any other user data you need here
        );
    }

    // Get the path to the assets from the build folder
    $plugin_url = plugin_dir_url(__FILE__);
    $react_app_base_path = $plugin_url . 'dist/';
    $assets_path = $plugin_url . 'dist/assets/';

    // Find the generated CSS and JS files
    $css_file = glob(plugin_dir_path(__FILE__) . 'dist/assets/index-*.css');
    $js_file = glob(plugin_dir_path(__FILE__) . 'dist/assets/index-*.js');

    if (empty($css_file) || empty($js_file)) {
        return 'Error: React app assets not found. Please run the build process.';
    }

    $css_file_url = $assets_path . basename($css_file[0]);
    $js_file_url = $assets_path . basename($js_file[0]);

    // Prepare the output buffer
    ob_start();
    ?>
    <link rel="stylesheet" href="<?php echo $css_file_url; ?>">
    <div id="root"></div>
    <script>
        // Pass user data to the React app
        window.wordpressUser = <?php echo json_encode($user_data); ?>;
    </script>
    <script type="module" src="<?php echo $js_file_url; ?>"></script>
    <?php
    return ob_get_clean();
}

add_shortcode('react_app', 'react_app_shortcode');