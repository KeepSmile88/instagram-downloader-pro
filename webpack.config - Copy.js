const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      // Background
      background: './src/background/index.js',
      
      // Content script
      content: './src/content/index.js',
      
      // UI pages
      'ui/popup/popup': './src/ui/popup/popup.js',
      'ui/preview/preview': './src/ui/preview/preview.js',
      'ui/onboarding/onboarding': './src/ui/onboarding/onboarding.js',
      'ui/options/options': './src/ui/options/options.js'
    },
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    chrome: '88'
                  }
                }]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        }
      ]
    },
    
    plugins: [
      new MiniCssExtractPlugin({
        filename: '[name].css'
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          // Manifest
          {
            from: 'manifest.json',
            to: 'manifest.json'
          },
          
          // HTML files
          {
            from: 'src/ui/popup/popup.html',
            to: 'ui/popup/popup.html'
          },
          {
            from: 'src/ui/preview/preview.html',
            to: 'ui/preview/preview.html'
          },
          {
            from: 'src/ui/onboarding/onboarding.html',
            to: 'ui/onboarding/onboarding.html'
          },
          {
            from: 'src/ui/options/options.html',
            to: 'ui/options/options.html'
          },
          
          // CSS files
          {
            from: 'src/ui/popup/popup.css',
            to: 'ui/popup/popup.css'
          },
          {
            from: 'src/ui/preview/preview.css',
            to: 'ui/preview/preview.css'
          },
          {
            from: 'src/ui/onboarding/onboarding.css',
            to: 'ui/onboarding/onboarding.css'
          },
          {
            from: 'src/ui/options/options.css',
            to: 'ui/options/options.css'
          },
          {
            from: 'src/content/content.css',
            to: 'content.css'
          },
          
          // Assets
          {
            from: 'assets',
            to: 'assets',
            noErrorOnMissing: true
          }
        ]
      })
    ],
    
    optimization: {
      minimize: isProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction
            }
          }
        })
      ]
    },
    
    resolve: {
      extensions: ['.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@core': path.resolve(__dirname, 'src/core'),
        '@background': path.resolve(__dirname, 'src/background'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@ui': path.resolve(__dirname, 'src/ui'),
        '@utils': path.resolve(__dirname, 'src/utils')
      }
    },
    
    devtool: isProduction ? false : 'source-map',
    
    stats: {
      colors: true,
      modules: false,
      children: false,
      chunks: false,
      chunkModules: false
    }
  };
};

