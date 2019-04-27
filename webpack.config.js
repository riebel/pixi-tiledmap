const path = require('path');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const HTMLWebpackPlugin = require('html-webpack-plugin');


const HTMLWebpackPluginConfig = new HTMLWebpackPlugin({
    template: 'example/index.html',
    filename: 'index.html',
    inject: 'head',
});

module.exports = {
    devServer: {
        host: 'localhost',
        port: '3000',
        contentBase: path.join(__dirname, 'example'),
        hot: false,
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
        historyApiFallback: true,
    },
    entry: path.join(__dirname, '/src/index.ts'),
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
        filename: 'pixi-tiledmap.min.js',
        libraryTarget: 'umd',
        library: 'pixi-tiledmap'
    },
    mode: 'none',
    target: 'web',
    optimization: {
        minimizer: [
            new UglifyJsPlugin({
                cache: true,
                parallel: true,
                uglifyOptions: {
                    compress: true,
                    ecma: 6,
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
