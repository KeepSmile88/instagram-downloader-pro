@chcp 65001 >nul 2>nul
@echo off

pushd %~dp0

md "instagram-downloader-pro" && cd "instagram-downloader-pro"
echo .>manifest.json
echo .>package.json
echo .>webpack.config.js
echo .>.eslintrc.js
echo .>.prettierrc
timeout /t 1 >nul
md public
md public\icons
md public\assets
md tests
md tests\unit
md tests\e2e

md src && cd src
md background
echo .>background\index.js
echo .>background\download-manager.js
echo .>background\session-manager.js
echo .>background\network-monitor.js

md content
echo .>content\index.js
echo .>content\scanner.js
echo .>content\ui-injector.js
echo .>content\credentials-extractor.js

md core
echo .>core\media-extractor.js
echo .>core\storage-manager.js
echo .>core\error-handler.js
echo .>core\logger.js

md ui
md ui\popup
echo .>ui\popup\popup.html
echo .>ui\popup\popup.js
echo .>ui\popup\popup.css

md ui\preview
echo .>ui\preview\preview.html
echo .>ui\preview\preview.js
echo .>ui\preview\preview.css

md ui\onboarding
echo .>ui\onboarding\onboarding.html
echo .>ui\onboarding\onboarding.js
echo .>ui\onboarding\onboarding.css

md ui\components
echo .>ui\components\notification.js
echo .>ui\components\progress-toast.js
echo .>ui\components\modal.js

md utils
echo .>utils\constants.js
echo .>utils\helpers.js
echo .>utils\security.js
echo .>utils\i18n.js

md styles
echo .>styles\global.js
echo .>styles\themes.js


timeout /t 2 >nul

echo. 初始化完成！

timeout /t 5 >nul 

pause