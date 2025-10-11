<?php
/**
 * WordPress Shortcode for 3D Printing Service Integration
 * 
 * Installation Instructions:
 * 1. Add this code to your theme's functions.php file
 * 2. Update YOUR_APP_URL with your actual deployment URL
 * 3. Use shortcode [3d_printing_service] in any page/post
 */

// Register the shortcode
function printing_service_shortcode($atts) {
    // Parse attributes
    $atts = shortcode_atts(array(
        'height' => '100vh',
        'width' => '100%',
    ), $atts);
    
    // Your app URL - UPDATE THIS!
    $app_url = 'YOUR_APP_URL_HERE'; // e.g., 'https://your-app.lovable.app'
    
    // Return the iframe HTML
    ob_start();
    ?>
    <div class="printing-service-wrapper" style="width: <?php echo esc_attr($atts['width']); ?>; margin: 0 auto;">
        <div class="printing-service-loader" id="printing-loader" style="display: flex; align-items: center; justify-content: center; min-height: 400px; font-family: Arial, sans-serif; color: #666;">
            <div>
                <svg width="50" height="50" viewBox="0 0 50 50" style="animation: spin 1s linear infinite; margin: 0 auto 20px;">
                    <circle cx="25" cy="25" r="20" fill="none" stroke="#00ccff" stroke-width="4" stroke-dasharray="80" stroke-dashoffset="60"/>
                </svg>
                <p>Loading 3D Printing Service...</p>
            </div>
        </div>
        <iframe 
            id="printing-service-iframe"
            src="<?php echo esc_url($app_url); ?>"
            style="width: 100%; height: <?php echo esc_attr($atts['height']); ?>; border: none; display: none;"
            title="3D Printing Online Service"
            allow="camera; geolocation"
            loading="lazy"
        ></iframe>
    </div>
    
    <style>
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .printing-service-wrapper {
            position: relative;
        }
        
        @media (max-width: 768px) {
            #printing-service-iframe {
                min-height: 80vh;
            }
        }
    </style>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const iframe = document.getElementById('printing-service-iframe');
            const loader = document.getElementById('printing-loader');
            
            if (iframe && loader) {
                iframe.addEventListener('load', function() {
                    loader.style.display = 'none';
                    iframe.style.display = 'block';
                });
                
                // Fallback - show iframe after 5 seconds if load event doesn't fire
                setTimeout(function() {
                    if (loader.style.display !== 'none') {
                        loader.style.display = 'none';
                        iframe.style.display = 'block';
                    }
                }, 5000);
            }
            
            // Handle messages from iframe for dynamic height
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'resize' && iframe) {
                    iframe.style.height = e.data.height + 'px';
                }
            });
        });
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('3d_printing_service', 'printing_service_shortcode');

/**
 * Optional: Add custom CSS to WordPress admin
 */
function printing_service_admin_css() {
    ?>
    <style>
        .printing-service-admin-notice {
            background: #e7f5ff;
            border-left: 4px solid #00ccff;
            padding: 12px;
            margin: 20px 0;
        }
    </style>
    <?php
}
add_action('admin_head', 'printing_service_admin_css');

/**
 * Optional: Add admin notice with usage instructions
 */
function printing_service_admin_notice() {
    $screen = get_current_screen();
    if ($screen->id === 'page' || $screen->id === 'post') {
        ?>
        <div class="printing-service-admin-notice">
            <strong>3D Printing Service Integration</strong>
            <p>Use the shortcode <code>[3d_printing_service]</code> to embed the 3D printing service.</p>
            <p>Optional parameters: <code>[3d_printing_service height="800px" width="100%"]</code></p>
        </div>
        <?php
    }
}
add_action('admin_notices', 'printing_service_admin_notice');

/**
 * Optional: Add Gutenberg block for easier integration
 */
function printing_service_gutenberg_block() {
    if (!function_exists('register_block_type')) {
        return;
    }
    
    wp_register_script(
        'printing-service-block',
        get_template_directory_uri() . '/js/printing-service-block.js',
        array('wp-blocks', 'wp-element', 'wp-editor'),
        filemtime(get_template_directory() . '/js/printing-service-block.js')
    );
    
    register_block_type('custom/printing-service', array(
        'editor_script' => 'printing-service-block',
        'render_callback' => 'printing_service_shortcode',
    ));
}
add_action('init', 'printing_service_gutenberg_block');
?>
