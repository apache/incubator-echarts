const preamble = require('./preamble');

exports.umdWrapperHead = `${preamble.js}
/**
* AUTO-GENERATED FILE. DO NOT MODIFY.
*/
(function (global, factory) {
   typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
   typeof define === 'function' && define.amd ? define(['exports'], factory) :
   (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory({}));
 }(this, (function (exports) {
`;

exports.umdWrapperHeadWithECharts = `${preamble.js}
/**
 * AUTO-GENERATED FILE. DO NOT MODIFY.
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('echarts/lib/echarts')) :
    typeof define === 'function' && define.amd ? define(['exports', 'echarts'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory({}, global.echarts));
  }(this, (function (exports, echarts) {
`;

exports.umdWrapperTail = `
})));`;
