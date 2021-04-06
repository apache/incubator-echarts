/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/

const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');
const {
    umdWrapperHead,
    umdWrapperHeadWithECharts,
    umdWrapperTail
} = require('./umd-wrapper');

async function buildThemeWrap() {
    const targetDir = path.join(__dirname, '../theme');
    const sourceDir = path.join(__dirname, '../src/theme');
    const files = fs.readdirSync(sourceDir);
    files.forEach(t => {
        // only read dir
        if(t.indexOf('.') !== -1) {
            return;
        }
        const echartsRegister = `
    echarts.registerTheme('${t}', themeObj);
        `;
        const pureExports = `
    for (var key in themeObj) {
        if (themeObj.hasOwnProperty(key)) {
            exports[key] = themeObj[key];
        }
    }
        `;
        const code = fs.readFileSync(path.join(sourceDir, t + '/theme.ts'), 'utf-8');
        const outputCode = code.replace(/export\s+?default/, 'var themeObj =')
            .replace(/\/\*([\w\W]*?)\*\//, '')
            // PENDING
            .replace(/const /g, 'var ')
            .replace(/ ?as any/g, '');

        fsExtra.ensureDirSync(targetDir);

        fs.writeFileSync(path.join(targetDir, t + '.js'), umdWrapperHeadWithECharts + outputCode + echartsRegister + umdWrapperTail, 'utf-8');
        fs.writeFileSync(path.join(targetDir, t + '-obj.js'), umdWrapperHead + outputCode + pureExports + umdWrapperTail, 'utf-8');
    })
    console.log('theme build completed');
}

buildThemeWrap();

module.exports = {
    buildTheme: buildThemeWrap
};
