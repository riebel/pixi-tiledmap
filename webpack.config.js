const path = require('path');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const HTMLWebpackPlugin = require('html-webpack-plugin');

const HTMLWebpackPluginConfig = new HTMLWebpackPlugin({
    template: 'examples/browser/index.html',
    inject: 'head',
    chunks: ['pixi-tiledmap.min']
});

module.exports = {
    devServer: {
        host: 'localhost',
        port: '3000',
        contentBase: path.join(__dirname, 'examples/browser'),
        hot: false,
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
        historyApiFallback: true,
    },
    entry: {
        'pixi-tiledmap': './src/index.ts',
        'pixi-tiledmap.min': './src/index.ts',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                loader: ['babel-loader'],
            }
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        libraryTarget: 'umd',
        library: 'pixi-tiledmap'
    },
    mode: 'none',
    target: 'web',
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                include: /\.min\.js$/,
                cache: true,
                parallel: true,
                uglifyOptions: {
                    compress: true,
                    mangle: true
                },
                sourceMap: true
            })
        ]
    },
    devtool: 'source-map',
    node: {
        fs: 'empty'
    },
    plugins: [HTMLWebpackPluginConfig, new webpack.HotModuleReplacementPlugin()]
};
