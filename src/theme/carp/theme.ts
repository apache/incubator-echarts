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

const colorPalette = [
    '#f0d8A8',
    '#3d1c00',
    '#86b8b1',
    '#f2d694',
    '#fa2a00',
    '#ff8066',
    '#ffd5cc',
    '#f9edd2'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#f0d8A8'
        }
    },

    visualMap: {
        color: ['#f0d8A8', '#3d1c00']
    },

    toolbox: {
        color: ['#f0d8A8', '#f0d8A8', '#f0d8A8', '#f0d8A8']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#f0d8A8',
                type: 'dashed'
            },
            crossStyle: {
                color: '#f0d8A8'
            },
            shadowStyle: {
                // Shadow indicator style settings
                color: 'rgba(200,200,200,0.3)'
            }
        }
    },

    // Area scaling controller
    dataZoom: {
        dataBackgroundColor: '#eee', // Data background color
        fillerColor: 'rgba(200,200,200,0.2)', // Fill the color
        handleColor: '#f0d8A8' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#f0dba8'
        },
        controlStyle: {
            color: '#f0dba8',
            borderColor: '#f0dba8'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#3d1c00',
            color0: '#86b8b1'
        },
        lineStyle: {
            width: 1,
            color: '#fa2a00',
            color0: '#f2d694'
        },
        areaStyle: {
            color: '#f0d8A8',
            color0: '#86b8b1'
        }
    },

    map: {
        itemStyle: {
            color: '#ddd'
        },
        areaStyle: {
            color: '#86b8b1'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#3d1c00'
        },
        linkStyle: {
            color: '#f0d8A8'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#3d1c00'],
                    [0.8, '#f0d8A8'],
                    [1, '#fa2a00']
                ],
                width: 8
            }
        }
    }
};
