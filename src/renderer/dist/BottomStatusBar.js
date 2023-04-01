"use strict";
exports.__esModule = true;
var Box_1 = require("@mui/material/Box");
var DiscordButton_1 = require("./DiscordButton");
var LogButton_1 = require("./LogButton");
var RecorderStatus_1 = require("./RecorderStatus");
var SavingStatus_1 = require("./SavingStatus");
var SettingsButton_1 = require("./SettingsButton");
var TestButton_1 = require("./TestButton");
var VersionUpdateWidget_1 = require("./VersionUpdateWidget");
var Navigator_1 = require("./Navigator");
var BottomStatusBar = function (props) {
    var navigation = props.navigation, setNavigation = props.setNavigation, recorderStatus = props.recorderStatus, upgradeStatus = props.upgradeStatus, savingStatus = props.savingStatus;
    return (React.createElement(Box_1["default"], { sx: {
            borderTop: '1px solid black',
            height: '35px',
            boxSizing: 'border-box',
            alignItems: 'flex-end'
        } },
        React.createElement(Box_1["default"], { sx: {
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                ml: 1,
                mr: 1
            } },
            React.createElement(Box_1["default"], { sx: {
                    display: 'flex',
                    flexDirection: 'row',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-start'
                } },
                React.createElement(RecorderStatus_1["default"], { recorderStatus: recorderStatus }),
                "/>",
                React.createElement(VersionUpdateWidget_1["default"], { upgradeStatus: upgradeStatus }),
                React.createElement(SavingStatus_1["default"], { savingStatus: true, savingStatus: true })),
            React.createElement(Navigator_1["default"], { navigation: navigation, setNavigation: setNavigation }),
            React.createElement(Box_1["default"], { sx: {
                    display: 'flex',
                    flexDirection: 'row',
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end'
                } },
                React.createElement(SettingsButton_1["default"], null),
                React.createElement(LogButton_1["default"], null),
                React.createElement(TestButton_1["default"], null),
                React.createElement(DiscordButton_1["default"], null)))));
};
exports["default"] = BottomStatusBar;
