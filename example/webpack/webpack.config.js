const webpack = require('webpack');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: 'dist/bundle.min.js'
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin()
    ]
};