const path = require('path');
const webpack = require('webpack');
const HTMLWebpackPlugin = require('html-webpack-plugin');

const HTMLWebpackPluginConfig = new HTMLWebpackPlugin({
    template: 'src/index.html',
    inject: true,
    chunks: ['bundle']
});

module.exports = {
    devServer: {
        host: 'localhost',
        port: '3000',
        contentBase: path.join(__dirname, 'src'),
        hot: false,
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
        historyApiFallback: true,
    },
    entry: {
        'bundle': './src/index.js',
    },
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: 'bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.(js)$/,
                use: 'babel-loader'
            }
        ]
    },
    target: 'web',
    node: {
        fs: 'empty'
    },
    plugins: [HTMLWebpackPluginConfig, new webpack.HotModuleReplacementPlugin()]
};