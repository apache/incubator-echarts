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
    '#e9e0d1',
    '#91a398',
    '#33605a',
    '#070001',
    '#68462b',
    '#58a79c',
    '#abd3ce',
    '#eef6f5'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#e9e0d1'
        }
    },

    visualMap: {
        color: ['#e9e0d1', '#91a398']
    },

    toolbox: {
        color: ['#e9e0d1', '#e9e0d1', '#e9e0d1', '#e9e0d1']
    },

    tooltip: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        axisPointer: {
            // Axis indicator, coordinate trigger effective
            type: 'line', // The default is a straight line： 'line' | 'shadow'
            lineStyle: {
                // Straight line indicator style settings
                color: '#e9e0d1',
                type: 'dashed'
            },
            crossStyle: {
                color: '#e9e0d1'
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
        handleColor: '#e9e0d1' // Handle color
    },

    timeline: {
        lineStyle: {
            color: '#e9e0d1'
        },
        controlStyle: {
            color: '#e9e0d1',
            borderColor: '#e9e0d1'
        }
    },

    candlestick: {
        itemStyle: {
            color: '#91a398',
            color0: '#33605a'
        },
        lineStyle: {
            width: 1,
            color: '#68462b',
            color0: '#070001'
        },
        areaStyle: {
            color: '#91a398',
            color0: '#abd3ce'
        }
    },

    map: {
        itemStyle: {
            color: '#c12e34'
        },
        areaStyle: {
            color: '#ddd'
        },
        label: {
            color: '#c12e34'
        }
    },

    graph: {
        itemStyle: {
            color: '#33605a'
        },
        linkStyle: {
            color: '#e9e0d1'
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#91a398'],
                    [0.8, '#e9e0d1'],
                    [1, '#68462b']
                ],
                width: 8
            }
        }
    }
};
