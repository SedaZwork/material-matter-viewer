/**
 * Gutenberg Block for 3D Printing Service
 * Place this file in your theme's js folder
 */

(function(blocks, element, editor) {
    var el = element.createElement;
    var registerBlockType = blocks.registerBlockType;
    var InspectorControls = editor.InspectorControls;
    var TextControl = wp.components.TextControl;
    var PanelBody = wp.components.PanelBody;

    registerBlockType('custom/printing-service', {
        title: '3D Printing Service',
        icon: 'admin-generic',
        category: 'embed',
        attributes: {
            height: {
                type: 'string',
                default: '100vh'
            },
            width: {
                type: 'string',
                default: '100%'
            }
        },

        edit: function(props) {
            var attributes = props.attributes;
            var setAttributes = props.setAttributes;

            function onChangeHeight(newHeight) {
                setAttributes({ height: newHeight });
            }

            function onChangeWidth(newWidth) {
                setAttributes({ width: newWidth });
            }

            return [
                el(InspectorControls, { key: 'inspector' },
                    el(PanelBody, { title: 'Settings', initialOpen: true },
                        el(TextControl, {
                            label: 'Height',
                            value: attributes.height,
                            onChange: onChangeHeight,
                            help: 'Enter height (e.g., 800px, 100vh)'
                        }),
                        el(TextControl, {
                            label: 'Width',
                            value: attributes.width,
                            onChange: onChangeWidth,
                            help: 'Enter width (e.g., 100%, 1200px)'
                        })
                    )
                ),
                el('div', { 
                    key: 'preview',
                    className: 'printing-service-block-preview',
                    style: {
                        border: '2px dashed #00ccff',
                        padding: '40px 20px',
                        textAlign: 'center',
                        background: '#f0f9ff',
                        borderRadius: '8px'
                    }
                },
                    el('svg', {
                        width: '50',
                        height: '50',
                        viewBox: '0 0 50 50',
                        style: { margin: '0 auto 20px', display: 'block' }
                    },
                        el('path', {
                            d: 'M25 5L5 15v20l20 10 20-10V15L25 5z',
                            fill: 'none',
                            stroke: '#00ccff',
                            strokeWidth: '2'
                        })
                    ),
                    el('h3', { style: { margin: '0 0 10px 0', color: '#333' } }, '3D Printing Service Block'),
                    el('p', { style: { margin: '0', color: '#666', fontSize: '14px' } },
                        'Height: ' + attributes.height + ' | Width: ' + attributes.width
                    ),
                    el('p', { style: { margin: '10px 0 0 0', color: '#999', fontSize: '12px' } },
                        'This block will display the 3D printing service on the frontend.'
                    )
                )
            ];
        },

        save: function() {
            // Render using PHP shortcode
            return null;
        }
    });
})(
    window.wp.blocks,
    window.wp.element,
    window.wp.editor
);
