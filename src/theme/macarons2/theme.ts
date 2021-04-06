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
    '#ed9678',
    '#e7dac9',
    '#cb8e85',
    '#f3f39d',
    '#c8e49c',
    '#f16d7a',
    '#f3d999',
    '#d3758f',
    '#dcc392',
    '#2e4783',
    '#82b6e9',
    '#ff6347',
    '#a092f1',
    '#0a915d',
    '#eaf889',
    '#6699FF',
    '#ff6666',
    '#3cb371',
    '#d5b158',
    '#38b6b6'
];

export default {
    color: colorPalette,

    title: {
        textStyle: {
            fontWeight: 'normal',
            color: '#cb8e85'
        }
    },

    dataRange: {
        color: ['#cb8e85', '#e7dac9'], //颜色
        //text:['高','低'],         // 文本，默认为数值文本
        textStyle: {
            color: '#333' // 值域文字颜色
        }
    },

    bar: {
        barMinHeight: 0, // 最小高度改为0
        // barWidth: null,        // 默认自适应
        barGap: '30%', // 柱间距离，默认为柱形宽度的30%，可设固定值
        barCategoryGap: '20%', // 类目间柱形距离，默认为类目间距的20%，可设固定值
        itemStyle: {
            normal: {
                // color: '各异',
                barBorderColor: '#fff', // 柱条边线
                barBorderRadius: 0, // 柱条边线圆角，单位px，默认为0
                barBorderWidth: 1, // 柱条边线线宽，单位px，默认为1
                label: {
                    show: false
                    // position: 默认自适应，水平布局为'top'，垂直布局为'right'，可选为
                    //           'inside'|'left'|'right'|'top'|'bottom'
                    // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                }
            },
            emphasis: {
                // color: '各异',
                barBorderColor: 'rgba(0,0,0,0)', // 柱条边线
                barBorderRadius: 0, // 柱条边线圆角，单位px，默认为0
                barBorderWidth: 1, // 柱条边线线宽，单位px，默认为1
                label: {
                    show: false
                    // position: 默认自适应，水平布局为'top'，垂直布局为'right'，可选为
                    //           'inside'|'left'|'right'|'top'|'bottom'
                    // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                }
            }
        }
    },

    line: {
        itemStyle: {
            normal: {
                // color: 各异,
                label: {
                    show: false
                    // position: 默认自适应，水平布局为'top'，垂直布局为'right'，可选为
                    //           'inside'|'left'|'right'|'top'|'bottom'
                    // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                },
                lineStyle: {
                    width: 2,
                    type: 'solid',
                    shadowColor: 'rgba(0,0,0,0)', //默认透明
                    shadowBlur: 5,
                    shadowOffsetX: 3,
                    shadowOffsetY: 3
                }
            },
            emphasis: {
                // color: 各异,
                label: {
                    show: false
                    // position: 默认自适应，水平布局为'top'，垂直布局为'right'，可选为
                    //           'inside'|'left'|'right'|'top'|'bottom'
                    // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
                }
            }
        },
        //smooth : false,
        //symbol: null,         // 拐点图形类型
        symbolSize: 2, // 拐点图形大小
        //symbolRotate : null,  // 拐点图形旋转控制
        showAllSymbol: false // 标志图形默认只有主轴显示（随主轴标签间隔隐藏策略）
    },

    candlestick: {
        itemStyle: {
            color: '#fe9778',
            color0: '#e7dac9'
        },
        lineStyle: {
            width: 1,
            color: '#f78766',
            color0: '#f1ccb8'
        },
        areaStyle: {
            color: '#e7dac9',
            color0: '#c8e49c'
        }
    },

    // 饼图默认参数
    pie: {
        center: ['50%', '50%'], // 默认全局居中
        radius: [0, '75%'],
        clockWise: false, // 默认逆时针
        startAngle: 90,
        minAngle: 0, // 最小角度改为0
        selectedOffset: 10, // 选中是扇区偏移量
        itemStyle: {
            // color: 各异,
            borderColor: '#fff',
            borderWidth: 1,
            label: {
                show: true,
                position: 'outer',
                color: '#1b1b1b',
                lineStyle: { color: '#1b1b1b' }
                // textStyle: null      // 默认使用全局文本样式，详见TEXTSTYLE
            },
            labelLine: {
                show: true,
                length: 20,
                lineStyle: {
                    // color: 各异,
                    width: 1,
                    type: 'solid'
                }
            }
        }
    },

    map: {
        itemStyle: {
            color: '#ddd',
            borderColor: '#fff',
            borderWidth: 1
        },
        areaStyle: {
            color: '#f3f39d'
        },
        label: {
            show: false,
            color: 'rgba(139,69,19,1)'
        },
        showLegendSymbol: true
    },

    graph: {
        itemStyle: {
            color: '#d87a80'
        },
        linkStyle: {
            strokeColor: '#a17e6e'
        },
        nodeStyle: {
            brushType: 'both',
            strokeColor: '#a17e6e'
        },
        label: {
            show: false
        }
    },

    gauge: {
        axisLine: {
            lineStyle: {
                color: [
                    [0.2, '#ed9678'],
                    [0.8, '#e7dac9'],
                    [1, '#cb8e85']
                ],
                width: 8
            }
        }
    }
};
