    /*
MIT License

Copyright (c) 2023 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
    */
    const __tmShortcutSidebar = (() => {
        // Exact shapes from Phosphor 2.1.1 assets/bold; populated with the build helper.
        const presets = [{"name":"sun","label":"\u592a\u9633 \u4eca\u65e5","category":"\u5e38\u7528","body":"<path d=\"M116,36V20a12,12,0,0,1,24,0V36a12,12,0,0,1-24,0Zm80,92a68,68,0,1,1-68-68A68.07,68.07,0,0,1,196,128Zm-24,0a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,128ZM51.51,68.49a12,12,0,1,0,17-17l-12-12a12,12,0,0,0-17,17Zm0,119-12,12a12,12,0,0,0,17,17l12-12a12,12,0,1,0-17-17ZM196,72a12,12,0,0,0,8.49-3.51l12-12a12,12,0,0,0-17-17l-12,12A12,12,0,0,0,196,72Zm8.49,115.51a12,12,0,0,0-17,17l12,12a12,12,0,0,0,17-17ZM48,128a12,12,0,0,0-12-12H20a12,12,0,0,0,0,24H36A12,12,0,0,0,48,128Zm80,80a12,12,0,0,0-12,12v16a12,12,0,0,0,24,0V220A12,12,0,0,0,128,208Zm108-92H220a12,12,0,0,0,0,24h16a12,12,0,0,0,0-24Z\"/>"},{"name":"calendar","label":"\u65e5\u5386 \u65e5\u671f","category":"\u5e38\u7528","body":"<path d=\"M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Zm60-80v56a12,12,0,0,1-24,0V143.32a12,12,0,0,1-9.37-22l16-8A12,12,0,0,1,112,124Zm61.49,33.88L163.9,168H168a12,12,0,0,1,0,24H136a12,12,0,0,1-8.71-20.25L155.45,142a4,4,0,0,0,.55-2,4,4,0,0,0-7.47-2,12,12,0,0,1-20.78-12A28,28,0,0,1,180,140a27.77,27.77,0,0,1-5.64,16.86A10.63,10.63,0,0,1,173.49,157.88Z\"/>"},{"name":"clock","label":"\u65f6\u949f \u65f6\u95f4","category":"\u5e38\u7528","body":"<path d=\"M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm68-84a12,12,0,0,1-12,12H128a12,12,0,0,1-12-12V72a12,12,0,0,1,24,0v44h44A12,12,0,0,1,196,128Z\"/>"},{"name":"flag","label":"\u65d7\u5e1c \u91cd\u70b9","category":"\u5e38\u7528","body":"<path d=\"M40.14,46.88A12,12,0,0,0,36,56V224a12,12,0,0,0,24,0V181.72c22.84-17.12,42.1-9.12,70.68,5,16.23,8,34.74,17.2,54.8,17.2,14.72,0,30.28-4.94,46.38-18.88A12,12,0,0,0,236,176V56a12,12,0,0,0-19.86-9.07c-24.71,21.41-44.53,13.31-74.82-1.68C113.19,31.27,78.17,13.94,40.14,46.88ZM212,170.26c-22.84,17.13-42.1,9.11-70.68-5C118.16,153.76,90.33,140,60,153.87V61.69c22.84-17.12,42.1-9.12,70.68,5,16.23,8,34.74,17.2,54.8,17.2A63,63,0,0,0,212,78.08Z\"/>"},{"name":"star","label":"\u661f\u6807 \u6536\u85cf","category":"\u5e38\u7528","body":"<path d=\"M243,96a20.33,20.33,0,0,0-17.74-14l-56.59-4.57L146.83,24.62a20.36,20.36,0,0,0-37.66,0L87.35,77.44,30.76,82A20.45,20.45,0,0,0,19.1,117.88l43.18,37.24-13.2,55.7A20.37,20.37,0,0,0,79.57,233L128,203.19,176.43,233a20.39,20.39,0,0,0,30.49-22.15l-13.2-55.7,43.18-37.24A20.43,20.43,0,0,0,243,96ZM172.53,141.7a12,12,0,0,0-3.84,11.86L181.58,208l-47.29-29.08a12,12,0,0,0-12.58,0L74.42,208l12.89-54.4a12,12,0,0,0-3.84-11.86L41.2,105.24l55.4-4.47a12,12,0,0,0,10.13-7.38L128,41.89l21.27,51.5a12,12,0,0,0,10.13,7.38l55.4,4.47Z\"/>"},{"name":"heart","label":"\u7231\u5fc3","category":"\u5e38\u7528","body":"<path d=\"M178,36c-20.09,0-37.92,7.93-50,21.56C115.92,43.93,98.09,36,78,36a66.08,66.08,0,0,0-66,66c0,72.34,105.81,130.14,110.31,132.57a12,12,0,0,0,11.38,0C138.19,232.14,244,174.34,244,102A66.08,66.08,0,0,0,178,36Zm-5.49,142.36A328.69,328.69,0,0,1,128,210.16a328.69,328.69,0,0,1-44.51-31.8C61.82,159.77,36,131.42,36,102A42,42,0,0,1,78,60c17.8,0,32.7,9.4,38.89,24.54a12,12,0,0,0,22.22,0C145.3,69.4,160.2,60,178,60a42,42,0,0,1,42,42C220,131.42,194.18,159.77,172.51,178.36Z\"/>"},{"name":"check-square","label":"\u6e05\u5355 \u5b8c\u6210","category":"\u5e38\u7528","body":"<path d=\"M79.51,144.49a12,12,0,1,1,17-17L112,143l47.51-47.52a12,12,0,0,1,17,17l-56,56a12,12,0,0,1-17,0ZM228,48V208a20,20,0,0,1-20,20H48a20,20,0,0,1-20-20V48A20,20,0,0,1,48,28H208A20,20,0,0,1,228,48Zm-24,4H52V204H204Z\"/>"},{"name":"house","label":"\u9996\u9875 \u5bb6","category":"\u5e38\u7528","body":"<path d=\"M222.14,105.85l-80-80a20,20,0,0,0-28.28,0l-80,80A19.86,19.86,0,0,0,28,120v96a12,12,0,0,0,12,12h64a12,12,0,0,0,12-12V164h24v52a12,12,0,0,0,12,12h64a12,12,0,0,0,12-12V120A19.86,19.86,0,0,0,222.14,105.85ZM204,204H164V152a12,12,0,0,0-12-12H104a12,12,0,0,0-12,12v52H52V121.65l76-76,76,76Z\"/>"},{"name":"calendar-check","label":"\u65e5\u5386\u5b8c\u6210","category":"\u65f6\u95f4","body":"<path d=\"M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Zm120.49-84.49a12,12,0,0,1,0,17l-48,48a12,12,0,0,1-17,0l-24-24a12,12,0,0,1,17-17L116,159l39.51-39.52A12,12,0,0,1,172.49,119.51Z\"/>"},{"name":"calendar-blank","label":"\u7a7a\u767d\u65e5\u5386","category":"\u65f6\u95f4","body":"<path d=\"M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Z\"/>"},{"name":"calendar-dots","label":"\u65e5\u5386\u5b89\u6392","category":"\u65f6\u95f4","body":"<path d=\"M208,28H188V24a12,12,0,0,0-24,0v4H92V24a12,12,0,0,0-24,0v4H48A20,20,0,0,0,28,48V208a20,20,0,0,0,20,20H208a20,20,0,0,0,20-20V48A20,20,0,0,0,208,28ZM68,52a12,12,0,0,0,24,0h72a12,12,0,0,0,24,0h16V76H52V52ZM52,204V100H204V204Zm92-76a16,16,0,1,1-16-16A16,16,0,0,1,144,128Zm48,0a16,16,0,1,1-16-16A16,16,0,0,1,192,128ZM96,176a16,16,0,1,1-16-16A16,16,0,0,1,96,176Zm48,0a16,16,0,1,1-16-16A16,16,0,0,1,144,176Zm48,0a16,16,0,1,1-16-16A16,16,0,0,1,192,176Z\"/>"},{"name":"clock-countdown","label":"\u5012\u8ba1\u65f6","category":"\u65f6\u95f4","body":"<path d=\"M236,137A108.13,108.13,0,1,1,119,20,12,12,0,0,1,121,44,84.12,84.12,0,1,0,212,135,12,12,0,1,1,236,137ZM116,76v52a12,12,0,0,0,12,12h52a12,12,0,0,0,0-24H140V76a12,12,0,0,0-24,0Zm92,20a16,16,0,1,0-16-16A16,16,0,0,0,208,96ZM176,64a16,16,0,1,0-16-16A16,16,0,0,0,176,64Z\"/>"},{"name":"timer","label":"\u8ba1\u65f6\u5668","category":"\u65f6\u95f4","body":"<path d=\"M128,44a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,44Zm0,168a72,72,0,1,1,72-72A72.08,72.08,0,0,1,128,212ZM164.49,99.51a12,12,0,0,1,0,17l-28,28a12,12,0,0,1-17-17l28-28A12,12,0,0,1,164.49,99.51ZM92,16A12,12,0,0,1,104,4h48a12,12,0,0,1,0,24H104A12,12,0,0,1,92,16Z\"/>"},{"name":"hourglass","label":"\u6c99\u6f0f","category":"\u65f6\u95f4","body":"<path d=\"M204,75.64V40a20,20,0,0,0-20-20H72A20,20,0,0,0,52,40V76a20.1,20.1,0,0,0,8,16l48,36L60,164a20.1,20.1,0,0,0-8,16v36a20,20,0,0,0,20,20H184a20,20,0,0,0,20-20V180.36a20.13,20.13,0,0,0-7.94-16L147.9,128l48.16-36.4A20.13,20.13,0,0,0,204,75.64ZM180,212H76V182l52-39,52,39.33Zm0-138.35L128,113,76,74V44H180Z\"/>"},{"name":"alarm","label":"\u95f9\u949f","category":"\u65f6\u95f4","body":"<path d=\"M128,36A100,100,0,1,0,228,136,100.11,100.11,0,0,0,128,36Zm0,176a76,76,0,1,1,76-76A76.08,76.08,0,0,1,128,212ZM32.49,72.49a12,12,0,1,1-17-17l32-32a12,12,0,1,1,17,17Zm208,0a12,12,0,0,1-17,0l-32-32a12,12,0,1,1,17-17l32,32A12,12,0,0,1,240.49,72.49ZM176,124a12,12,0,0,1,0,24H128a12,12,0,0,1-12-12V88a12,12,0,0,1,24,0v36Z\"/>"},{"name":"moon","label":"\u6708\u4eae \u665a\u4e0a","category":"\u65f6\u95f4","body":"<path d=\"M236.37,139.4a12,12,0,0,0-12-3A84.07,84.07,0,0,1,119.6,31.59a12,12,0,0,0-15-15A108.86,108.86,0,0,0,49.69,55.07,108,108,0,0,0,136,228a107.09,107.09,0,0,0,64.93-21.69,108.86,108.86,0,0,0,38.44-54.94A12,12,0,0,0,236.37,139.4Zm-49.88,47.74A84,84,0,0,1,68.86,69.51,84.93,84.93,0,0,1,92.27,48.29Q92,52.13,92,56A108.12,108.12,0,0,0,200,164q3.87,0,7.71-.27A84.79,84.79,0,0,1,186.49,187.14Z\"/>"},{"name":"briefcase","label":"\u516c\u6587\u5305 \u5de5\u4f5c","category":"\u5de5\u4f5c","body":"<path d=\"M100,100a12,12,0,0,1,12-12h32a12,12,0,0,1,0,24H112A12,12,0,0,1,100,100ZM236,68V196a20,20,0,0,1-20,20H40a20,20,0,0,1-20-20V68A20,20,0,0,1,40,48H76V40a28,28,0,0,1,28-28h48a28,28,0,0,1,28,28v8h36A20,20,0,0,1,236,68ZM100,48h56V40a4,4,0,0,0-4-4H104a4,4,0,0,0-4,4ZM44,72v35.23A180.06,180.06,0,0,0,128,128a180,180,0,0,0,84-20.78V72ZM212,192V133.94A204.27,204.27,0,0,1,128,152a204.21,204.21,0,0,1-84-18.06V192Z\"/>"},{"name":"target","label":"\u76ee\u6807","category":"\u5de5\u4f5c","body":"<path d=\"M229.26,90.4a108,108,0,0,1-177.63,114A108,108,0,0,1,195.41,43.63l20.1-20.11a12,12,0,0,1,17,17l-96,96a12,12,0,1,1-17-17l24-24a36,36,0,1,0,19.76,39.65,12,12,0,0,1,23.53,4.74,60,60,0,1,1-25.73-62L178.3,60.74a84,84,0,1,0,28.46,38,12,12,0,1,1,22.5-8.35Z\"/>"},{"name":"lightning","label":"\u95ea\u7535","category":"\u5de5\u4f5c","body":"<path d=\"M219.71,117.38a12,12,0,0,0-7.25-8.52L161.28,88.39l10.59-70.61a12,12,0,0,0-20.64-10l-112,120a12,12,0,0,0,4.31,19.33l51.18,20.47L84.13,238.22a12,12,0,0,0,20.64,10l112-120A12,12,0,0,0,219.71,117.38ZM113.6,203.55l6.27-41.77a12,12,0,0,0-7.41-12.92L68.74,131.37,142.4,52.45l-6.27,41.77a12,12,0,0,0,7.41,12.92l43.72,17.49Z\"/>"},{"name":"rocket","label":"\u706b\u7bad \u9879\u76ee","category":"\u5de5\u4f5c","body":"<path d=\"M156,228a12,12,0,0,1-12,12H112a12,12,0,0,1,0-24h32A12,12,0,0,1,156,228ZM128,116a16,16,0,1,0-16-16A16,16,0,0,0,128,116Zm99.53,40.7-12.36,55.63a19.9,19.9,0,0,1-12.88,14.53A20.16,20.16,0,0,1,195.6,228a19.87,19.87,0,0,1-12.29-4.27L157.17,204H98.83L72.69,223.74A19.87,19.87,0,0,1,60.4,228a20.16,20.16,0,0,1-6.69-1.15,19.9,19.9,0,0,1-12.88-14.53L28.47,156.7a20.1,20.1,0,0,1,4.16-17.14l27.83-33.4A127,127,0,0,1,69.11,69.7c13.27-33.25,37-54.1,46.64-61.52a20,20,0,0,1,24.5,0c9.6,7.42,33.37,28.27,46.64,61.52a127,127,0,0,1,8.65,36.46l27.83,33.4A20.1,20.1,0,0,1,227.53,156.7ZM101.79,180h52.42c19.51-35.7,23-69.78,10.39-101.4C154.4,53,136.2,35.9,128,29.12,119.8,35.9,101.6,53,91.4,78.6,78.78,110.22,82.28,144.3,101.79,180Zm-22.55,8.72a168,168,0,0,1-16.92-47.3l-10,12,10.58,47.64Zm124.43-35.31-10-12a168,168,0,0,1-16.92,47.3l16.33,12.33Z\"/>"},{"name":"kanban","label":"\u770b\u677f","category":"\u5de5\u4f5c","body":"<path d=\"M216,44H40A12,12,0,0,0,28,56V208a20,20,0,0,0,20,20H88a20,20,0,0,0,20-20V164h40v12a20,20,0,0,0,20,20h40a20,20,0,0,0,20-20V56A12,12,0,0,0,216,44Zm-12,64H172V68h32ZM84,68v40H52V68Zm0,136H52V132H84Zm24-64V68h40v72Zm64,32V132h32v40Z\"/>"},{"name":"chart-bar","label":"\u7edf\u8ba1 \u67f1\u72b6\u56fe","category":"\u5de5\u4f5c","body":"<path d=\"M224,196h-4V40a12,12,0,0,0-12-12H152a12,12,0,0,0-12,12V76H96A12,12,0,0,0,84,88v36H48a12,12,0,0,0-12,12v60H32a12,12,0,0,0,0,24H224a12,12,0,0,0,0-24ZM164,52h32V196H164Zm-56,48h32v96H108ZM60,148H84v48H60Z\"/>"},{"name":"table","label":"\u8868\u683c","category":"\u5de5\u4f5c","body":"<path d=\"M224,44H32A12,12,0,0,0,20,56V192a20,20,0,0,0,20,20H216a20,20,0,0,0,20-20V56A12,12,0,0,0,224,44ZM44,116H76v24H44Zm56,0H212v24H100ZM212,68V92H44V68ZM44,164H76v24H44Zm56,24V164H212v24Z\"/>"},{"name":"presentation-chart","label":"\u6f14\u793a \u62a5\u544a","category":"\u5de5\u4f5c","body":"<path d=\"M216,36H140V24a12,12,0,0,0-24,0V36H40A20,20,0,0,0,20,56V176a20,20,0,0,0,20,20H71l-16.4,20.5a12,12,0,0,0,18.74,15l28.4-35.5h52.46l28.4,35.5a12,12,0,0,0,18.74-15L185,196h31a20,20,0,0,0,20-20V56A20,20,0,0,0,216,36Zm-4,136H44V60H212ZM104,120v24a12,12,0,0,1-24,0V120a12,12,0,0,1,24,0Zm24-28a12,12,0,0,1,12,12v40a12,12,0,0,1-24,0V104A12,12,0,0,1,128,92Zm24,52V88a12,12,0,0,1,24,0v56a12,12,0,0,1-24,0Z\"/>"},{"name":"folder","label":"\u6587\u4ef6\u5939 \u5206\u7ec4","category":"\u6587\u6863","body":"<path d=\"M216,68H133.39l-26-29.29a20,20,0,0,0-15-6.71H40A20,20,0,0,0,20,52V200.62A19.41,19.41,0,0,0,39.38,220H216.89A19.13,19.13,0,0,0,236,200.89V88A20,20,0,0,0,216,68ZM44,56H90.61l10.67,12H44ZM212,196H44V92H212Z\"/>"},{"name":"folder-open","label":"\u6253\u5f00\u6587\u4ef6\u5939","category":"\u6587\u6863","body":"<path d=\"M248.23,112.31A20,20,0,0,0,232,104H220V88a20,20,0,0,0-20-20H132L105.34,48a20.12,20.12,0,0,0-12-4H40A20,20,0,0,0,20,64V208a12,12,0,0,0,12,12H211.1a12,12,0,0,0,11.33-8l28.49-81.47.06-.17A20,20,0,0,0,248.23,112.31ZM92,68l28.8,21.6A12,12,0,0,0,128,92h68v12H69.77a20,20,0,0,0-18.94,13.58L44,137.15V68ZM202.59,196H48.89l23.72-68H226.37Z\"/>"},{"name":"file-text","label":"\u6587\u6863 \u6587\u4ef6","category":"\u6587\u6863","body":"<path d=\"M216.49,79.52l-56-56A12,12,0,0,0,152,20H56A20,20,0,0,0,36,40V216a20,20,0,0,0,20,20H200a20,20,0,0,0,20-20V88A12,12,0,0,0,216.49,79.52ZM160,57l23,23H160ZM60,212V44h76V92a12,12,0,0,0,12,12h48V212Zm112-80a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,132Zm0,40a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h64A12,12,0,0,1,172,172Z\"/>"},{"name":"files","label":"\u591a\u4e2a\u6587\u6863","category":"\u6587\u6863","body":"<path d=\"M220.49,59.51l-40-40A12,12,0,0,0,172,16H92A20,20,0,0,0,72,36V56H56A20,20,0,0,0,36,76V216a20,20,0,0,0,20,20H164a20,20,0,0,0,20-20V196h20a20,20,0,0,0,20-20V68A12,12,0,0,0,220.49,59.51ZM160,212H60V80h67l33,33Zm40-40H184V108a12,12,0,0,0-3.51-8.49l-40-40A12,12,0,0,0,132,56H96V40h71l33,33Zm-56-28a12,12,0,0,1-12,12H88a12,12,0,0,1,0-24h44A12,12,0,0,1,144,144Zm0,40a12,12,0,0,1-12,12H88a12,12,0,0,1,0-24h44A12,12,0,0,1,144,184Z\"/>"},{"name":"book-open","label":"\u9605\u8bfb \u4e66\u672c","category":"\u6587\u6863","body":"<path d=\"M232,44H160a43.86,43.86,0,0,0-32,13.85A43.86,43.86,0,0,0,96,44H24A12,12,0,0,0,12,56V200a12,12,0,0,0,12,12H96a20,20,0,0,1,20,20,12,12,0,0,0,24,0,20,20,0,0,1,20-20h72a12,12,0,0,0,12-12V56A12,12,0,0,0,232,44ZM96,188H36V68H96a20,20,0,0,1,20,20V192.81A43.79,43.79,0,0,0,96,188Zm124,0H160a43.71,43.71,0,0,0-20,4.83V88a20,20,0,0,1,20-20h60Z\"/>"},{"name":"books","label":"\u4e66\u7c4d","category":"\u6587\u6863","body":"<path d=\"M235.57,193.73,202.38,35.93a20,20,0,0,0-23.76-15.48L131.81,30.51a19.82,19.82,0,0,0-11,6.65A20,20,0,0,0,104,28H56A20,20,0,0,0,36,48V208a20,20,0,0,0,20,20h48a20,20,0,0,0,20-20V90.25l25.62,121.82A20,20,0,0,0,169.15,228a20.27,20.27,0,0,0,4.23-.45l46.81-10.06A20.1,20.1,0,0,0,235.57,193.73ZM148.19,88.65l39-8.38,2.53,12-39,8.38Zm7.46,35.5,39-8.38,9.16,43.58-39,8.38Zm24.06-79.39,2.53,12-39,8.38-2.53-12ZM60,88h40v80H60Zm40-36V64H60V52ZM60,204V192h40v12Zm112.29-.76-2.53-12,39-8.38,2.53,12Z\"/>"},{"name":"bookmark","label":"\u4e66\u7b7e","category":"\u6587\u6863","body":"<path d=\"M184,28H72A20,20,0,0,0,52,48V224a12,12,0,0,0,18.36,10.18l57.63-36,57.65,36A12,12,0,0,0,204,224V48A20,20,0,0,0,184,28Zm-4,24V154.35l-45.65-28.53a12,12,0,0,0-12.72,0L76,154.35V52ZM134.35,173.82a12,12,0,0,0-12.72,0L76,202.35v-19.7l52-32.5,52,32.5v19.7Z\"/>"},{"name":"note-pencil","label":"\u7b14\u8bb0 \u5199\u4f5c","category":"\u6587\u6863","body":"<path d=\"M232.49,55.51l-32-32a12,12,0,0,0-17,0l-96,96A12,12,0,0,0,84,128v32a12,12,0,0,0,12,12h32a12,12,0,0,0,8.49-3.51l96-96A12,12,0,0,0,232.49,55.51ZM192,49l15,15L196,75,181,60Zm-69,99H108V133l56-56,15,15Zm105-7.43V208a20,20,0,0,1-20,20H48a20,20,0,0,1-20-20V48A20,20,0,0,1,48,28h67.43a12,12,0,0,1,0,24H52V204H204V140.57a12,12,0,0,1,24,0Z\"/>"},{"name":"graduation-cap","label":"\u5b66\u4e60 \u6bd5\u4e1a","category":"\u5b66\u4e60","body":"<path d=\"M249.8,85.49l-116-64a12,12,0,0,0-11.6,0l-116,64a12,12,0,0,0,0,21l21.8,12v47.76a19.89,19.89,0,0,0,5.09,13.32C46.63,194.7,77,220,128,220a136.88,136.88,0,0,0,40-5.75V240a12,12,0,0,0,24,0V204.12a119.53,119.53,0,0,0,30.91-24.51A19.89,19.89,0,0,0,228,166.29V118.53l21.8-12a12,12,0,0,0,0-21ZM128,45.71,219.16,96,186,114.3a1.88,1.88,0,0,1-.18-.12l-52-28.69a12,12,0,0,0-11.6,21l39,21.49L128,146.3,36.84,96ZM128,196c-40.42,0-64.65-19.07-76-31.27v-33l70.2,38.74a12,12,0,0,0,11.6,0L168,151.64v37.23A110.46,110.46,0,0,1,128,196Zm76-31.27a93.21,93.21,0,0,1-12,10.81V138.39l12-6.62Z\"/>"},{"name":"brain","label":"\u5927\u8111 \u601d\u8003","category":"\u5b66\u4e60","body":"<path d=\"M252,124a60.14,60.14,0,0,0-32-53.08,52,52,0,0,0-92-32.11A52,52,0,0,0,36,70.92a60,60,0,0,0,0,106.14,52,52,0,0,0,92,32.13,52,52,0,0,0,92-32.13A60.05,60.05,0,0,0,252,124ZM88,204a28,28,0,0,1-26.85-20.07c1,0,1.89.07,2.85.07h8a12,12,0,0,0,0-24H64A36,36,0,0,1,52,90.05a12,12,0,0,0,8-11.32V72a28,28,0,0,1,56,0v60.18a51.61,51.61,0,0,0-7.2-3.85,12,12,0,1,0-9.6,22A28,28,0,0,1,88,204Zm104-44h-8a12,12,0,0,0,0,24h8c1,0,1.9,0,2.85-.07a28,28,0,1,1-38-33.61,12,12,0,1,0-9.6-22,51.61,51.61,0,0,0-7.2,3.85V72a28,28,0,0,1,56,0v6.73a12,12,0,0,0,8,11.32,36,36,0,0,1-12,70Zm16-44a12,12,0,0,1-12,12,40,40,0,0,1-40-40V84a12,12,0,0,1,24,0v4a16,16,0,0,0,16,16A12,12,0,0,1,208,116ZM100,88a40,40,0,0,1-40,40,12,12,0,0,1,0-24A16,16,0,0,0,76,88V84a12,12,0,0,1,24,0Z\"/>"},{"name":"lightbulb","label":"\u706f\u6ce1 \u60f3\u6cd5","category":"\u5b66\u4e60","body":"<path d=\"M180,232a12,12,0,0,1-12,12H88a12,12,0,0,1,0-24h80A12,12,0,0,1,180,232Zm40-128a91.51,91.51,0,0,1-35.17,72.35A12.26,12.26,0,0,0,180,186v2a20,20,0,0,1-20,20H96a20,20,0,0,1-20-20v-2a12,12,0,0,0-4.7-9.51A91.57,91.57,0,0,1,36,104.52C35.73,54.69,76,13.2,125.79,12A92,92,0,0,1,220,104Zm-24,0a68,68,0,0,0-69.65-68C89.56,36.88,59.8,67.55,60,104.38a67.71,67.71,0,0,0,26.1,53.19A35.87,35.87,0,0,1,100,184h56.1A36.13,36.13,0,0,1,170,157.49,67.68,67.68,0,0,0,196,104Zm-20.07-5.32a48.5,48.5,0,0,0-31.91-40,12,12,0,0,0-8,22.62,24.31,24.31,0,0,1,16.09,20,12,12,0,0,0,23.86-2.64Z\"/>"},{"name":"pencil-simple","label":"\u94c5\u7b14 \u7f16\u8f91","category":"\u5b66\u4e60","body":"<path d=\"M230.14,70.54,185.46,25.85a20,20,0,0,0-28.29,0L33.86,149.17A19.85,19.85,0,0,0,28,163.31V208a20,20,0,0,0,20,20H92.69a19.86,19.86,0,0,0,14.14-5.86L230.14,98.82a20,20,0,0,0,0-28.28ZM91,204H52V165l84-84,39,39ZM192,103,153,64l18.34-18.34,39,39Z\"/>"},{"name":"magnifying-glass","label":"\u641c\u7d22 \u653e\u5927\u955c","category":"\u5b66\u4e60","body":"<path d=\"M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z\"/>"},{"name":"code","label":"\u4ee3\u7801","category":"\u5b66\u4e60","body":"<path d=\"M71.68,97.22,34.74,128l36.94,30.78a12,12,0,1,1-15.36,18.44l-48-40a12,12,0,0,1,0-18.44l48-40A12,12,0,0,1,71.68,97.22Zm176,21.56-48-40a12,12,0,1,0-15.36,18.44L221.26,128l-36.94,30.78a12,12,0,1,0,15.36,18.44l48-40a12,12,0,0,0,0-18.44ZM164.1,28.72a12,12,0,0,0-15.38,7.18l-64,176a12,12,0,0,0,7.18,15.37A11.79,11.79,0,0,0,96,228a12,12,0,0,0,11.28-7.9l64-176A12,12,0,0,0,164.1,28.72Z\"/>"},{"name":"laptop","label":"\u7b14\u8bb0\u672c\u7535\u8111","category":"\u5b66\u4e60","body":"<path d=\"M232,156h-4V72a28,28,0,0,0-28-28H56A28,28,0,0,0,28,72v84H24a12,12,0,0,0-12,12v24a28,28,0,0,0,28,28H216a28,28,0,0,0,28-28V168A12,12,0,0,0,232,156ZM52,72a4,4,0,0,1,4-4H200a4,4,0,0,1,4,4v84H52ZM220,192a4,4,0,0,1-4,4H40a4,4,0,0,1-4-4V180H220ZM156,96a12,12,0,0,1-12,12H112a12,12,0,0,1,0-24h32A12,12,0,0,1,156,96Z\"/>"},{"name":"globe","label":"\u5730\u7403 \u4e16\u754c","category":"\u5b66\u4e60","body":"<path d=\"M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,187a113.4,113.4,0,0,1-20.39-35h40.82a116.94,116.94,0,0,1-10,20.77A108.61,108.61,0,0,1,128,207Zm-26.49-59a135.42,135.42,0,0,1,0-40h53a135.42,135.42,0,0,1,0,40ZM44,128a83.49,83.49,0,0,1,2.43-20H77.25a160.63,160.63,0,0,0,0,40H46.43A83.49,83.49,0,0,1,44,128Zm84-79a113.4,113.4,0,0,1,20.39,35H107.59a116.94,116.94,0,0,1,10-20.77A108.61,108.61,0,0,1,128,49Zm50.73,59h30.82a83.52,83.52,0,0,1,0,40H178.75a160.63,160.63,0,0,0,0-40Zm20.77-24H173.71a140.82,140.82,0,0,0-15.5-34.36A84.51,84.51,0,0,1,199.52,84ZM97.79,49.64A140.82,140.82,0,0,0,82.29,84H56.48A84.51,84.51,0,0,1,97.79,49.64ZM56.48,172H82.29a140.82,140.82,0,0,0,15.5,34.36A84.51,84.51,0,0,1,56.48,172Zm101.73,34.36A140.82,140.82,0,0,0,173.71,172h25.81A84.51,84.51,0,0,1,158.21,206.36Z\"/>"},{"name":"coffee","label":"\u5496\u5561","category":"\u751f\u6d3b","body":"<path d=\"M212,76H32A12,12,0,0,0,20,88v48a100.24,100.24,0,0,0,26.73,68H32a12,12,0,0,0,0,24H208a12,12,0,0,0,0-24H193.27a100.75,100.75,0,0,0,20-32A44,44,0,0,0,256,128v-8A44.05,44.05,0,0,0,212,76Zm-16,60a76.27,76.27,0,0,1-42,68H86a76.27,76.27,0,0,1-42-68V100H196Zm36-8a20,20,0,0,1-12.57,18.55A97.17,97.17,0,0,0,220,136V101.68A20,20,0,0,1,232,120ZM68,48V24a12,12,0,0,1,24,0V48a12,12,0,0,1-24,0Zm40,0V24a12,12,0,0,1,24,0V48a12,12,0,0,1-24,0Zm40,0V24a12,12,0,0,1,24,0V48a12,12,0,0,1-24,0Z\"/>"},{"name":"plant","label":"\u690d\u7269","category":"\u751f\u6d3b","body":"<path d=\"M255.62,51.65a12,12,0,0,0-11.27-11.27c-53.27-3.13-96.2,13.36-114.84,44.14-12.14,20-12.56,44.17-1.46,67.3a75.14,75.14,0,0,0-12.28,23l-12.66-12.66c7.19-16.77,6.43-34.11-2.4-48.69C86.73,90.36,54.89,78,15.55,80.27A12,12,0,0,0,4.28,91.55C2,130.89,14.36,162.73,37.45,176.71a49.76,49.76,0,0,0,26,7.27,57.54,57.54,0,0,0,22.7-4.87L112,205v23a12,12,0,0,0,24,0V198.51a51.63,51.63,0,0,1,9.49-29.95,76.82,76.82,0,0,0,32.1,7.39,64.91,64.91,0,0,0,33.89-9.46C242.25,147.85,258.76,104.92,255.62,51.65ZM49.88,156.18c-13.19-8-21.18-27.46-21.83-52.13,24.67.65,44.14,8.64,52.13,21.83a26,26,0,0,1,3.63,17L72.48,131.51a12,12,0,0,0-17,17l11.34,11.34A26.27,26.27,0,0,1,49.88,156.18ZM199.05,146c-10.66,6.45-23,7.67-35.81,3.76l37.25-37.24a12,12,0,0,0-17-17l-37.25,37.24C142.37,120,143.59,107.61,150,97c12.7-21,42.65-33,81.32-33H232C232.14,103,220.14,133.18,199.05,146Z\"/>"},{"name":"barbell","label":"\u8fd0\u52a8 \u5065\u8eab","category":"\u751f\u6d3b","body":"<path d=\"M244,116V88a20,20,0,0,0-20-20H208V64a20,20,0,0,0-20-20H164a20,20,0,0,0-20,20v52H112V64A20,20,0,0,0,92,44H68A20,20,0,0,0,48,64v4H32A20,20,0,0,0,12,88v28a12,12,0,0,0,0,24v28a20,20,0,0,0,20,20H48v4a20,20,0,0,0,20,20H92a20,20,0,0,0,20-20V140h32v52a20,20,0,0,0,20,20h24a20,20,0,0,0,20-20v-4h16a20,20,0,0,0,20-20V140a12,12,0,0,0,0-24ZM36,164V92H48v72Zm52,24H72V68H88Zm96,0H168V68h16Zm36-24H208V92h12Z\"/>"},{"name":"music-note","label":"\u97f3\u4e50","category":"\u751f\u6d3b","body":"<path d=\"M211.45,52.51l-80-24A12,12,0,0,0,116,40V140.22A52,52,0,1,0,140,184V104.13l64.55,19.36A12,12,0,0,0,220,112V64A12,12,0,0,0,211.45,52.51ZM88,212a28,28,0,1,1,28-28A28,28,0,0,1,88,212ZM196,95.87l-56-16.8V56.13l56,16.8Z\"/>"},{"name":"camera","label":"\u76f8\u673a \u62cd\u7167","category":"\u751f\u6d3b","body":"<path d=\"M208,52H182.42L170,33.34A12,12,0,0,0,160,28H96a12,12,0,0,0-10,5.34L73.57,52H48A28,28,0,0,0,20,80V192a28,28,0,0,0,28,28H208a28,28,0,0,0,28-28V80A28,28,0,0,0,208,52Zm4,140a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V80a4,4,0,0,1,4-4H80a12,12,0,0,0,10-5.34L102.42,52h51.15L166,70.66A12,12,0,0,0,176,76h32a4,4,0,0,1,4,4ZM128,84a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,84Zm0,72a24,24,0,1,1,24-24A24,24,0,0,1,128,156Z\"/>"},{"name":"map-pin","label":"\u5730\u56fe \u4f4d\u7f6e","category":"\u751f\u6d3b","body":"<path d=\"M128,60a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,60Zm0,64a20,20,0,1,1,20-20A20,20,0,0,1,128,124Zm0-112a92.1,92.1,0,0,0-92,92c0,77.36,81.64,135.4,85.12,137.83a12,12,0,0,0,13.76,0,259,259,0,0,0,42.18-39C205.15,170.57,220,136.37,220,104A92.1,92.1,0,0,0,128,12Zm31.3,174.71A249.35,249.35,0,0,1,128,216.89a249.35,249.35,0,0,1-31.3-30.18C80,167.37,60,137.31,60,104a68,68,0,0,1,136,0C196,137.31,176,167.37,159.3,186.71Z\"/>"},{"name":"airplane","label":"\u98de\u673a \u65c5\u884c","category":"\u751f\u6d3b","body":"<path d=\"M237.37,125.27,164,88.58V48a36,36,0,0,0-72,0V88.58L18.63,125.27A12,12,0,0,0,12,136v32a12,12,0,0,0,14.35,11.77L92,166.64V179L79.51,191.51A12,12,0,0,0,76,200v32a12,12,0,0,0,16.46,11.14L128,228.92l35.54,14.22A11.91,11.91,0,0,0,168,244a12,12,0,0,0,12-12V200a12,12,0,0,0-3.51-8.49L164,179V166.64l65.65,13.13A12,12,0,0,0,244,168V136A12,12,0,0,0,237.37,125.27ZM220,153.36l-65.65-13.13A12,12,0,0,0,140,152v32a12,12,0,0,0,3.51,8.49L156,205v9.31l-23.54-9.42a12,12,0,0,0-8.92,0L100,214.28V205l12.49-12.48A12,12,0,0,0,116,184V152a12,12,0,0,0-14.35-11.77L36,153.36v-9.94l73.37-36.69A12,12,0,0,0,116,96V48a12,12,0,0,1,24,0V96a12,12,0,0,0,6.63,10.73L220,143.42Z\"/>"},{"name":"game-controller","label":"\u6e38\u620f","category":"\u751f\u6d3b","body":"<path d=\"M176,116H152a12,12,0,0,1,0-24h24a12,12,0,0,1,0,24ZM104,92h-4V88a12,12,0,0,0-24,0v4H72a12,12,0,0,0,0,24h4v4a12,12,0,0,0,24,0v-4h4a12,12,0,0,0,0-24ZM244.76,202.94a40,40,0,0,1-61,5.35,7,7,0,0,1-.53-.56L144.67,164H111.33L72.81,207.73c-.17.19-.35.38-.53.56A40,40,0,0,1,4.62,173.05a1.18,1.18,0,0,1,0-.2L21,88.79A63.88,63.88,0,0,1,83.88,36H172a64.08,64.08,0,0,1,62.93,52.48,1.8,1.8,0,0,1,0,.19l16.36,84.17a1.77,1.77,0,0,1,0,.2A39.74,39.74,0,0,1,244.76,202.94ZM172,140a40,40,0,0,0,0-80H83.89A39.9,39.9,0,0,0,44.62,93.06a1.55,1.55,0,0,0,0,.21l-16.34,84a16,16,0,0,0,13,18.44,16.07,16.07,0,0,0,13.86-4.21L96.9,144.07a12,12,0,0,1,9-4.07Zm55.76,37.31-7-35.95a63.84,63.84,0,0,1-44.27,22.46l24.41,27.72a16,16,0,0,0,26.85-14.23Z\"/>"}]; // SHORTCUT_BOLD_PRESETS
        const presetMap = new Map(presets.map(item => [item.name, item]));
        const normalizePreferences = value => {
            const stored = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
            return { mode: ['full', 'rail', 'hidden'].includes(stored.mode) ? stored.mode : 'full',
                width: Math.max(200, Math.min(320, Number(stored.width) || 200)),
                rail: 40, edgePosition: Number.isFinite(Number(stored.edgePosition))
                    ? Math.max(0, Math.min(1, Number(stored.edgePosition))) : .5,
                hideGuideAcknowledged: stored.hideGuideAcknowledged === true,
                calendarView: stored.calendarView === 'week' ? 'week' : 'month' };
        };
        const preferences = normalizePreferences(Storage.get('tm_shortcut_sidebar_preferences', {}));
        const preferencePlatform = () => __tmIsRuntimeMobileClient() ? 'mobile' : 'desktop';
        let preferencesRestored = false;
        let sidebar = null, layout = null, observer = null, narrow = false, drawer = false;
        let drawerHover = false, drawerHoverTimer = null, edgeDragging = false;
        let popup = null, popupOwner = null, popupClose = null, popupSession = 0, drawerUnstack = null;
        let hideGuide = null, hideGuideUnstack = null, hideGuideFrame = 0, hideGuideContentInert = false;
        let scrollTimer = null, optionRequest = 0, resizing = null;
        let countTimer = null, countGeneration = 0, unsubscribe = null;
        const lastCounts = new Map(Object.entries(Storage.get('tm_shortcut_counts', {}) || {})
            .filter(([, value]) => typeof value?.key === 'string' && Number.isFinite(value.count) && value.count >= 0));
        function cachedCount(item) {
            const cached = lastCounts.get(item.id);
            return cached?.key === __tmShortcuts.countKey(item) ? cached.count : null;
        }
        function rememberCounts() {
            const items = new Map(__tmShortcuts.items().map(item => [item.id, item]));
            let changed = false;
            for (const id of lastCounts.keys()) if (!items.has(id)) { lastCounts.delete(id);changed = true; }
            for (const [id, count] of __tmShortcuts.counts()) {
                const item = items.get(id);
                if (!item) continue;
                const key = __tmShortcuts.countKey(item), previous = lastCounts.get(id);
                if (previous?.key === key && previous.count === count) continue;
                lastCounts.set(id, { key, count });changed = true;
            }
            if (changed) Storage.set('tm_shortcut_counts', Object.fromEntries(lastCounts));
        }
        let hoverId = '', hoverFrame = 0;
        const q = (selector, root = popup) => root?.querySelector(selector);
        const controlIcons = {"arrows-down-up":"<path d=\"M120.49,167.51a12,12,0,0,1,0,17l-32,32a12,12,0,0,1-17,0l-32-32a12,12,0,1,1,17-17L68,179V48a12,12,0,0,1,24,0V179l11.51-11.52A12,12,0,0,1,120.49,167.51Zm96-96-32-32a12,12,0,0,0-17,0l-32,32a12,12,0,0,0,17,17L164,77V208a12,12,0,0,0,24,0V77l11.51,11.52a12,12,0,0,0,17-17Z\"/>","plus":"<path d=\"M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z\"/>","caret-left":"<path d=\"M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z\"/>","caret-right":"<path d=\"M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z\"/>","x":"<path d=\"M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z\"/>","arrow-up":"<path d=\"M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z\"/>","arrow-down":"<path d=\"M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z\"/>","push-pin-simple":"<path d=\"M216,164h-5.93L190.3,52H192a12,12,0,0,0,0-24H64a12,12,0,0,0,0,24h1.7L45.93,164H40a12,12,0,0,0,0,24h76v52a12,12,0,0,0,24,0V188h76a12,12,0,0,0,0-24ZM90.07,52h75.86L185.7,164H70.3Z\"/>","dots-three":"<path d=\"M144,128a16,16,0,1,1-16-16A16,16,0,0,1,144,128ZM60,112a16,16,0,1,0,16,16A16,16,0,0,0,60,112Zm136,0a16,16,0,1,0,16,16A16,16,0,0,0,196,112Z\"/>"};
        const glyph = name => `<svg viewBox="0 0 256 256" fill="currentColor" stroke="none" aria-hidden="true">${controlIcons[name] || ''}</svg>`;
        const button = (action, name, icon) => `<button type="button" class="tm-shortcut-tool" data-shortcut-action="${action}" aria-label="${name}" title="${name}">${glyph(icon)}</button>`;
        function iconHtml(icon) {
            if (icon?.type === 'siyuan') {
                const emoji = __tmDocIconCodeToEmoji(icon.value), src = __tmResolveDocIconImageSrc(icon.value);
                if (emoji || src) return `<span class="tm-shortcut-icon" aria-hidden="true">${src ? `<img src="${esc(src)}" alt="" draggable="false" referrerpolicy="no-referrer">` : esc(emoji)}</span>`;
            }
            const preset = presetMap.get(icon?.name) || presetMap.get('star');
            return `<span class="tm-shortcut-icon" aria-hidden="true"><svg viewBox="0 0 256 256" fill="currentColor" stroke="none">${preset?.body || ''}</svg></span>`;
        }
        const persistPreferences = () => {
            Storage.set('tm_shortcut_sidebar_preferences', preferences);
            SettingsStore.data.shortcutSidebarPreferences = {
                ...SettingsStore.data.shortcutSidebarPreferences,
                [preferencePlatform()]: { ...preferences },
            };
            void SettingsStore.save({ suppressMobileCloseSyncDirty: true })
                .catch(() => hint('侧栏状态保存失败，请重试', 'warning'));
        };
        function restorePreferences() {
            if (preferencesRestored || !SettingsStore.loaded) return;
            const saved = SettingsStore.data.shortcutSidebarPreferences?.[preferencePlatform()];
            if (saved) Object.assign(preferences, normalizePreferences(saved));
            preferencesRestored = true;
        }
        function scrollThumb() {
            const viewport = q('.tm-shortcut-list', sidebar), thumb = q('.tm-shortcut-scroll-thumb', sidebar);
            if (!viewport || !thumb) return;
            const overflow = viewport.scrollHeight - viewport.clientHeight;
            thumb.hidden = overflow <= 1;
            if (overflow <= 1) return;
            const height = Math.max(24, viewport.clientHeight ** 2 / viewport.scrollHeight);
            thumb.style.height = `${height}px`;
            thumb.style.transform = `translateY(${2 + (viewport.clientHeight - height - 4) * viewport.scrollTop / overflow}px)`;
        }
        function refresh() {
            if (!sidebar) return;
            rememberCounts();
            const viewport = q('.tm-shortcut-list', sidebar), top = viewport.scrollTop;
            const activeId = __tmShortcuts.activeId();
            viewport.innerHTML = __tmShortcuts.items().map(item => {
                const issues = __tmShortcuts.issues(item), labels = __tmShortcuts.names(item);
                const path = [labels.group, ...(item.tabGroupId ? [labels.tabGroup] : []), labels.doc, labels.view,
                    ...(item.viewId === 'kanban' ? [labels.kanbanBoardMode] : []), labels.groupMode, labels.rule].join(' → ');
                return `<div class="tm-shortcut-row ${issues.length ? 'is-invalid' : ''}"><button type="button" class="tm-shortcut-go" data-shortcut-id="${esc(item.id)}" title="${esc(item.name + (issues.length ? ' · 已失效' : '') + '\n' + path)}" aria-label="${esc(item.name + (issues.length ? '，已失效' : ''))}" ${activeId === item.id ? 'aria-current="page"' : ''}>${iconHtml(item.icon)}<span class="tm-shortcut-name">${esc(item.name)}</span>${issues.length ? '<span class="tm-shortcut-invalid">失效</span>' : `<span class="tm-shortcut-count" data-shortcut-count="${esc(item.id)}">${cachedCount(item) ?? ''}</span>`}</button>${button('edit', `编辑${esc(item.name)}`, 'dots-three').replace('data-shortcut-action="edit"', `data-shortcut-edit="${esc(item.id)}"`)}</div>`;
            }).join('') || '<div class="tm-shortcut-empty">把常用的文档范围、视图和规则存到这里。</div>';
            viewport.scrollTop = top;
            applyMode();scrollThumb();scheduleCounts();
        }
        function scheduleCounts() {
            clearTimeout(countTimer);const generation = ++countGeneration;
            countTimer = setTimeout(async () => {
                if (generation !== countGeneration || !sidebar?.isConnected) return;
                rememberCounts();
                const counts = __tmShortcuts.counts();
                const items = new Map(__tmShortcuts.items().map(item => [item.id, item]));
                for (const node of sidebar.querySelectorAll('[data-shortcut-count]')) {
                    const id = node.dataset.shortcutCount, item = items.get(id);
                    if (!item) continue;
                    const count = counts.get(id);
                    const display = count ?? cachedCount(item);
                    node.textContent = display == null ? '' : String(display);
                    node.title = count == null ? '打开快捷项后更新任务数' : `${count} 项任务匹配此快捷项`;
                }
                const labelCount = q('.tm-shortcut-extension-count', layout);
                const hovered = items.get(hoverId);
                if (labelCount && hovered) labelCount.textContent = cachedCount(hovered) ?? '';
                globalThis.__tmDateFilter?.refresh();
            }, 100);
        }
        function hideName() {
            cancelAnimationFrame(hoverFrame);hoverFrame = 0;hoverId = '';
            q('.tm-shortcut-name-extension', layout)?.classList.remove('is-visible');
            sidebar?.querySelector('.is-name-open')?.classList.remove('is-name-open');
        }
        function showName(button) {
            if (!button || layout?.dataset.shortcutMode !== 'rail') return;
            const item = __tmShortcuts.items().find(item => item.id === button.dataset.shortcutId);
            if (!item) return;
            const extension = q('.tm-shortcut-name-extension', layout);
            if (hoverId === item.id && extension.classList.contains('is-visible')) return;
            hideName();hoverId = item.id;button.parentElement.classList.add('is-name-open');
            const row = button.getBoundingClientRect(), parent = layout.getBoundingClientRect();
            extension.style.left = `${row.right - parent.left}px`;extension.style.top = `${row.top - parent.top}px`;
            extension.classList.toggle('is-active', button.hasAttribute('aria-current'));
            extension.innerHTML = `<span>${esc(item.name)}</span><span class="tm-shortcut-extension-count">${cachedCount(item) ?? ''}</span>`;
            extension.dataset.shortcutExtensionId = item.id;
            extension.setAttribute('aria-label', item.name);
            hoverFrame = requestAnimationFrame(() => { if (extension.isConnected && hoverId === item.id) extension.classList.add('is-visible'); });
        }
        function applyMode() {
            if (!layout?.isConnected || !sidebar?.isConnected || !state.modal?.isConnected) return;
            const mode = drawer ? 'drawer' : narrow ? 'hidden' : preferences.mode;
            const modalDrawer = __tmIsRuntimeMobileClient() || (__tmIsDockHost() && layout.clientWidth < 768);
            layout.dataset.shortcutMode = mode;
            layout.dataset.shortcutNarrow = String(narrow);
            layout.dataset.shortcutModal = String(modalDrawer);
            if (mode !== 'rail') hideName();
            layout.style.setProperty('--tm-shortcut-width', `${preferences.width}px`);
            layout.style.setProperty('--tm-shortcut-rail', `${preferences.rail}px`);
            layout.style.setProperty('--tm-shortcut-fold', String(preferences.rail / preferences.width));
            layout.style.setProperty('--tm-shortcut-edge-position', `${preferences.edgePosition * 100}%`);
            sidebar.inert = mode === 'hidden';
            sidebar.setAttribute('aria-hidden', String(mode === 'hidden'));
            q('.tm-shortcut-full-tools', sidebar).inert = mode === 'rail';
            q('.tm-shortcut-rail-tools', sidebar).inert = mode !== 'rail';
            const pin = q('[data-shortcut-action="pin"]', sidebar);
            pin.hidden = narrow;pin.setAttribute('aria-pressed', String(mode === 'full'));
            pin.setAttribute('aria-label', drawer ? '固定侧栏' : '悬浮侧栏');pin.title = drawer ? '固定侧栏' : '悬浮侧栏';
            q('[data-shortcut-action="hide"]', sidebar).inert = mode !== 'rail';
            sidebar.querySelectorAll('[data-shortcut-edit]').forEach(node => { node.inert = mode === 'rail'; });
            sidebar.querySelectorAll('[data-shortcut-id]').forEach(node => {
                if (mode === 'rail' && node.hasAttribute('title')) { node.dataset.shortcutTitle = node.title;node.removeAttribute('title'); }
                else if (mode !== 'rail' && node.dataset.shortcutTitle) { node.title = node.dataset.shortcutTitle;delete node.dataset.shortcutTitle; }
            });
            const content = q(':scope > .tm-main-stage', layout);
            content.inert = drawer && modalDrawer;
            sidebar.setAttribute('role', drawer ? 'dialog' : 'navigation');
            if (drawer) sidebar.setAttribute('aria-modal', String(modalDrawer));
            else sidebar.removeAttribute('aria-modal');
            globalThis.__tmDateFilter?.mount(sidebar, state.modal, mode, preferences, persistPreferences);
            scrollThumb();
        }
        function setMode(mode) {
            const content = q(':scope > .tm-main-stage', layout), before = content?.getBoundingClientRect().left;
            if (mode !== 'hidden') closeHideGuide(false);
            closeDrawer(false);preferences.mode = mode;persistPreferences();applyMode();
            const after = content?.getBoundingClientRect().left;
            if (!narrow && before !== undefined && before !== after) content.animate([{ transform: `translateX(${before - after}px)` }, { transform: 'translateX(0)' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
            const target = mode === 'hidden' ? q('.tm-shortcut-edge', layout) : mode === 'rail' ? q('[data-shortcut-action="expand"]', sidebar) : q('[data-shortcut-action="collapse"]', sidebar);
            target?.focus({ preventScroll: true });
        }
        function closeDrawer(restoreFocus = true) {
            clearDrawerHoverTimer();drawerHover = false;
            drawer = false;drawerUnstack?.();drawerUnstack = null;applyMode();
            if (restoreFocus && layout?.dataset.shortcutMode === 'hidden') q('.tm-shortcut-edge', layout)?.focus({ preventScroll: true });
            return Promise.all((sidebar?.getAnimations?.() || []).map(animation => animation.finished.catch(() => {})));
        }
        function openDrawer(fromHover = false) {
            closeHideGuide(false);
            clearDrawerHoverTimer();drawerHover = fromHover;
            drawer = true;applyMode();drawerUnstack?.();drawerUnstack = __tmModalStackBind(() => closeDrawer());
            if (!fromHover) q('[data-shortcut-action="collapse"]', sidebar)?.focus({ preventScroll: true });
        }
        function clearDrawerHoverTimer() {
            clearTimeout(drawerHoverTimer);drawerHoverTimer = null;
        }
        function leaveDrawerZone(event) {
            if (event.pointerType !== 'mouse') return;
            if (!drawerHover) { clearDrawerHoverTimer();return; }
            const target = event.relatedTarget;
            if (target?.nodeType && (sidebar?.contains(target) || q('.tm-shortcut-edge', layout)?.contains(target))) { clearDrawerHoverTimer();return; }
            updateDrawerHoverZone(event);
        }
        function updateDrawerHoverZone(event) {
            if (event.pointerType !== 'mouse' || !drawerHover || edgeDragging) return;
            const area = layout?.getBoundingClientRect();
            // Use the final drawer region, not its translated position during animation.
            const width = sidebar?.getBoundingClientRect().width || 0;
            if (area && event.clientX >= area.left && event.clientX <= area.left + width
                && event.clientY >= area.top && event.clientY <= area.bottom) {
                clearDrawerHoverTimer();return;
            }
            if (drawerHoverTimer) return;
            drawerHoverTimer = setTimeout(() => {
                drawerHoverTimer = null;
                if (drawerHover && !edgeDragging) closeDrawer(false);
            }, 110);
        }
        function closeHideGuide(restoreFocus = true) {
            const wasOpen = !!hideGuide;
            cancelAnimationFrame(hideGuideFrame);hideGuideFrame = 0;
            hideGuideUnstack?.();hideGuideUnstack = null;
            layout?.removeEventListener('keydown', hideGuideKeydown);
            layout?.classList.remove('is-hide-guide-open');
            const content = q(':scope > .tm-main-stage', layout);
            if (content && wasOpen) content.inert = hideGuideContentInert;
            hideGuideContentInert = false;
            hideGuide?.remove();hideGuide = null;
            if (restoreFocus && layout?.dataset.shortcutMode === 'hidden') q('.tm-shortcut-edge', layout)?.focus({ preventScroll: true });
        }
        function positionHideGuide() {
            if (!hideGuide?.isConnected || !layout) return;
            const area = layout.getBoundingClientRect(), edge = q('.tm-shortcut-edge', layout)?.getBoundingClientRect();
            const panel = q('.tm-shortcut-hide-guide-panel', hideGuide);
            if (!edge || !panel) return;
            const width = Math.max(260, Math.min(320, area.width - 56));
            panel.style.width = `${width}px`;
            const edgeCenter = edge.top - area.top + edge.height / 2;
            const top = Math.max(12, Math.min(area.height - panel.offsetHeight - 12, edgeCenter - panel.offsetHeight / 2));
            panel.style.left = `${edge.right - area.left + 18}px`;
            panel.style.top = `${top}px`;
            panel.style.setProperty('--tm-hide-guide-pointer-top', `${Math.max(18, Math.min(panel.offsetHeight - 18, edgeCenter - top))}px`);
        }
        function hideGuideKeydown(event) {
            if (event.key !== 'Tab' || !hideGuide?.isConnected) return;
            const focusable = [q('.tm-shortcut-edge', layout), q('[data-hide-guide-close]', hideGuide), q('[data-hide-guide-acknowledge]', hideGuide)].filter(Boolean);
            if (!focusable.length) return;
            const index = focusable.indexOf(document.activeElement);
            event.preventDefault();
            focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus({ preventScroll: true });
        }
        function showHideGuide() {
            if (!layout?.isConnected || narrow || drawer || preferences.mode !== 'hidden'
                || preferences.hideGuideAcknowledged || hideGuide?.isConnected
                || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI()) return false;
            const content = q(':scope > .tm-main-stage', layout);
            if (!content) return false;
            hideGuideContentInert = content.inert;
            hideGuide = document.createElement('div');hideGuide.className = 'tm-shortcut-hide-guide';
            hideGuide.setAttribute('role', 'dialog');hideGuide.setAttribute('aria-modal', 'true');
            hideGuide.setAttribute('aria-labelledby', 'tm-shortcut-hide-guide-title');
            hideGuide.setAttribute('aria-describedby', 'tm-shortcut-hide-guide-description');
            hideGuide.innerHTML = `<button type="button" class="tm-shortcut-hide-guide-scrim" data-hide-guide-close aria-label="关闭隐藏侧栏提示"></button><section class="tm-shortcut-hide-guide-panel"><button type="button" class="tm-shortcut-hide-guide-close" data-hide-guide-close aria-label="关闭隐藏侧栏提示" title="关闭">${glyph('x')}</button><h2 id="tm-shortcut-hide-guide-title">从这里重新展开</h2><p id="tm-shortcut-hide-guide-description">快捷方式侧栏已完全隐藏。点击左侧的<strong>半透明箭头</strong>，即可重新打开。</p><div class="tm-shortcut-hide-guide-footer"><span>按住可上下拖拽调节位置</span><button type="button" class="b3-button tm-shortcut-hide-guide-acknowledge" data-hide-guide-acknowledge>知道了</button></div></section>`;
            layout.append(hideGuide);layout.classList.add('is-hide-guide-open');content.inert = true;
            hideGuide.querySelectorAll('[data-hide-guide-close]').forEach(button => { button.onclick = () => closeHideGuide(); });
            q('[data-hide-guide-acknowledge]', hideGuide).onclick = () => {
                preferences.hideGuideAcknowledged = true;persistPreferences();closeHideGuide();
            };
            hideGuideUnstack = __tmModalStackBind(() => closeHideGuide());
            layout.addEventListener('keydown', hideGuideKeydown);
            positionHideGuide();
            q('[data-hide-guide-acknowledge]', hideGuide)?.focus({ preventScroll: true });
            return true;
        }
        function queueHideGuide() {
            cancelAnimationFrame(hideGuideFrame);
            hideGuideFrame = requestAnimationFrame(() => {
                hideGuideFrame = 0;
                showHideGuide();
            });
        }
        function mount(modal) {
            if (SettingsStore.data.shortcutSidebarEnabled === false) { dispose();return; }
            restorePreferences();
            const content = modal?.querySelector('.tm-main-stage');
            if (!content) return;
            hideName();clearDrawerHoverTimer();
            observer?.disconnect();
            const parent = content.parentElement;
            const initialNarrow = parent.clientWidth < 768 || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI();
            if (narrow !== initialNarrow) { narrow = initialNarrow;closeDrawer(false); }
            layout = document.createElement('div');layout.className = 'tm-shortcut-layout';
            // Set visibility before insertion: measuring the connected layout would
            // otherwise start a transition from the default expanded sidebar.
            layout.dataset.shortcutMode = drawer ? 'drawer' : narrow ? 'hidden' : preferences.mode;
            layout.dataset.shortcutNarrow = String(narrow);
            layout.addEventListener('pointermove', updateDrawerHoverZone);
            layout.addEventListener('pointerleave', leaveDrawerZone);
            if (!sidebar) {
                sidebar = document.createElement('aside');sidebar.className = 'tm-shortcut-sidebar';sidebar.setAttribute('aria-label', '快捷导航');
                unsubscribe = globalThis.__tmTaskStore?.subscribe?.(scheduleCounts) || null;
                window.addEventListener('tm:filtered-tasks-updated', scheduleCounts);
                sidebar.innerHTML = `<header class="tm-shortcut-head"><div class="tm-shortcut-full-tools">${button('sort', '快捷项排序', 'arrows-down-up')}${button('add', '新增快捷项', 'plus')}<span class="tm-shortcut-spacer"></span>${button('pin', '切换固定与悬浮', 'push-pin-simple')}${button('collapse', '收起侧栏', 'caret-left')}</div><div class="tm-shortcut-rail-tools">${button('expand', '展开完整侧栏', 'caret-right')}</div></header><div class="tm-shortcut-list-wrap"><div class="tm-shortcut-list"></div><i class="tm-shortcut-scroll-thumb" hidden></i></div><footer>${button('hide', '完全隐藏侧栏', 'x')}</footer><div class="tm-shortcut-resize" role="separator" aria-label="调整侧栏宽度" aria-orientation="vertical" tabindex="0"></div>`;
                sidebar.addEventListener('click', event => {
                    const action = event.target.closest('[data-shortcut-action]')?.dataset.shortcutAction;
                    const id = event.target.closest('[data-shortcut-id]')?.dataset.shortcutId;
                    const editId = event.target.closest('[data-shortcut-edit]')?.dataset.shortcutEdit;
                    if (id) void __tmShortcuts.open(id).catch(error => hint(error.message, 'error'));
                    else if (editId) void edit(__tmShortcuts.items().find(item => item.id === editId));
                    else if (action === 'add') void edit();
                    else if (action === 'sort') sort();
                    else if (action === 'pin') { if (drawer) setMode('full');else { setMode('hidden');openDrawer(); } }
                    else if (action === 'expand') setMode('full');
                    else if (action === 'hide') { setMode('hidden');queueHideGuide(); }
                    else if (action === 'collapse') drawer ? closeDrawer() : setMode('rail');
                });
                sidebar.addEventListener('contextmenu', event => {
                    const id = event.target.closest('[data-shortcut-id]')?.dataset.shortcutId;
                    if (id) { event.preventDefault();void edit(__tmShortcuts.items().find(item => item.id === id)); }
                });
                sidebar.addEventListener('pointerover', event => { if (event.pointerType === 'mouse') { const button = event.target.closest('[data-shortcut-id]');button ? showName(button) : hideName(); } });
                sidebar.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') clearDrawerHoverTimer(); });
                sidebar.addEventListener('pointerleave', leaveDrawerZone);
                sidebar.addEventListener('focusin', event => showName(event.target.closest('[data-shortcut-id]')));
                sidebar.addEventListener('pointerleave', event => { if (!event.relatedTarget?.closest?.('.tm-shortcut-name-extension')) hideName(); });
                sidebar.addEventListener('focusout', event => { if (!sidebar.contains(event.relatedTarget) && !event.relatedTarget?.closest?.('.tm-shortcut-name-extension')) hideName(); });
                q('.tm-shortcut-list', sidebar).addEventListener('scroll', () => {
                    hideName();scrollThumb();sidebar.classList.add('is-scrolling');clearTimeout(scrollTimer);
                    scrollTimer = setTimeout(() => sidebar?.classList.remove('is-scrolling'), 650);
                }, { passive: true });
                const resize = q('.tm-shortcut-resize', sidebar);
                resize.onpointerdown = event => { if (event.button !== 0) return;resizing = { x: event.clientX, width: preferences.width };resize.setPointerCapture(event.pointerId);event.preventDefault(); };
                resize.onpointermove = event => { if (!resizing) return;preferences.width = Math.max(200, Math.min(320, Math.round(resizing.width + event.clientX - resizing.x)));applyMode(); };
                resize.onpointerup = resize.onpointercancel = () => { resizing = null;persistPreferences(); };
                resize.onkeydown = event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;event.preventDefault();preferences.width = Math.max(200, Math.min(320, preferences.width + (event.key === 'ArrowRight' ? 8 : -8)));persistPreferences();applyMode(); };
            }
            parent.insertBefore(layout, content);
            layout.append(sidebar, content);
            // Share one stacking context so the drawer and its scrim cover the
            // bottom navigation without lifting the task body above that bar.
            const bottomBar = parent.querySelector(':scope > .tm-mobile-bottom-viewbar');
            if (bottomBar) layout.append(bottomBar);
            const scrim = document.createElement('button');scrim.className = 'tm-shortcut-scrim';scrim.setAttribute('aria-label', '关闭快捷导航');scrim.onclick = () => closeDrawer();layout.append(scrim);
            const edge = document.createElement('button');edge.className = 'tm-shortcut-edge';edge.setAttribute('aria-label', '打开快捷导航');edge.title = '打开快捷导航，上下拖动调整位置';edge.innerHTML = glyph('caret-right');layout.append(edge);
            edge.onpointerenter = event => {
                if (event.pointerType !== 'mouse' || event.buttons || hideGuide?.isConnected || __tmIsRuntimeMobileClient() || drawer || edgeDragging) return;
                clearDrawerHoverTimer();
                drawerHoverTimer = setTimeout(() => {
                    drawerHoverTimer = null;
                    if (edge.isConnected && edge.matches(':hover') && !edgeDragging && !drawer && !__tmIsRuntimeMobileClient()) openDrawer(true);
                }, 300);
            };
            edge.onpointerleave = leaveDrawerZone;
            let edgeDrag = null, suppressEdgeClick = false;
            const moveEdge = center => {
                const height = layout.clientHeight, margin = edge.offsetHeight / 2 + 4;
                if (height <= 0) return;
                preferences.edgePosition = Math.max(margin, Math.min(height - margin, center)) / height;
                layout.style.setProperty('--tm-shortcut-edge-position', `${preferences.edgePosition * 100}%`);
                positionHideGuide();
            };
            edge.onpointerdown = event => {
                if (event.button !== 0) return;
                clearDrawerHoverTimer();edgeDragging = true;
                suppressEdgeClick = false;
                const rect = edge.getBoundingClientRect();
                edgeDrag = { id: event.pointerId, y: event.clientY, center: rect.top + rect.height / 2 - layout.getBoundingClientRect().top, moved: false };
                edge.setPointerCapture(event.pointerId);
            };
            edge.onpointermove = event => {
                if (!edgeDrag || event.pointerId !== edgeDrag.id) return;
                const delta = event.clientY - edgeDrag.y;
                if (!edgeDrag.moved && Math.abs(delta) < 6) return;
                edgeDrag.moved = true;moveEdge(edgeDrag.center + delta);
            };
            const finishEdgeDrag = event => {
                if (!edgeDrag || event.pointerId !== edgeDrag.id) return;
                suppressEdgeClick = edgeDrag.moved;
                edgeDragging = false;clearDrawerHoverTimer();
                if (edgeDrag.moved) persistPreferences();
                edgeDrag = null;
                if (edge.hasPointerCapture(event.pointerId)) edge.releasePointerCapture(event.pointerId);
            };
            edge.onpointerup = edge.onpointercancel = edge.onlostpointercapture = finishEdgeDrag;
            edge.onclick = event => { if (suppressEdgeClick && event.detail !== 0) { event.preventDefault();return; }openDrawer(); };
            edge.onkeydown = event => {
                if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();const rect = edge.getBoundingClientRect();
                moveEdge(rect.top + rect.height / 2 - layout.getBoundingClientRect().top + (event.key === 'ArrowUp' ? -24 : 24));persistPreferences();
            };
            const extension = document.createElement('button');extension.className = 'tm-shortcut-name-extension';extension.type = 'button';extension.tabIndex = -1;
            extension.onclick = () => { const id = extension.dataset.shortcutExtensionId;hideName();if (id) void __tmShortcuts.open(id); };
            extension.onpointerleave = event => { if (!event.relatedTarget?.closest?.('[data-shortcut-id]')) hideName(); };
            layout.append(extension);
            const resize = () => {
                const next = layout.clientWidth < 768 || __tmIsRuntimeMobileClient() || __tmHostUsesMobileUI();
                if (narrow !== next) { narrow = next;closeDrawer(false); }
                applyMode();positionHideGuide();
            };
            observer = new ResizeObserver(resize);observer.observe(layout);resize();refresh();
            if (!narrow && !__tmIsRuntimeMobileClient() && !__tmHostUsesMobileUI() && preferences.mode === 'hidden') queueHideGuide();
        }
        function closePopup() { popupClose?.(); }
        function showPopup(title, body, footer = '', width = '460px') {
            closePopup();hideName();const origin = document.activeElement;if (drawer) closeDrawer(false);const session = ++popupSession;
            const Dialog = globalThis.__tmHost?.getBridge?.()?.Dialog;
            const content = `<div class="tm-shortcut-popup"><div class="tm-shortcut-popup-body">${body}</div>${footer ? `<footer class="tm-shortcut-popup-footer">${footer}</footer>` : ''}</div>`;
            let unstack = null, owner = null;
            const finish = () => {
                if (session !== popupSession) return;
                unstack?.();popup = null;popupOwner = null;popupClose = null;popupSession++;optionRequest++;
                if (origin?.isConnected && !origin.closest('[inert]')) origin.focus({ preventScroll: true });
                else if (layout?.dataset.shortcutMode === 'hidden') q('.tm-shortcut-edge', layout)?.focus({ preventScroll: true });
            };
            if (Dialog) {
                window.siyuan.zIndex = Math.max(Number(window.siyuan.zIndex) || 0, Number(getComputedStyle(state.modal).zIndex) || 100001);
                owner = new Dialog({ title, content, width, containerClassName: 'tm-shortcut-dialog-host', destroyCallback: finish });
                popup = owner.element.querySelector('.tm-shortcut-popup');popupClose = () => owner.destroy();
            } else {
                owner = document.createElement('div');owner.className = 'tm-shortcut-backdrop';
                owner.innerHTML = `<div class="tm-shortcut-dialog-host" role="dialog" aria-modal="true" aria-label="${esc(title)}" style="width:${width}"><header><strong>${esc(title)}</strong>${button('close', '关闭弹窗', 'x')}</header>${content}</div>`;
                document.body.append(owner);popup = owner.querySelector('.tm-shortcut-popup');
                popupClose = () => { owner.remove();finish(); };
                owner.onclick = event => { if (event.target === owner || event.target.closest('[data-shortcut-action="close"]')) closePopup(); };
                unstack = __tmModalStackBind(closePopup);
            }
            popupOwner = owner;
            const theme = getComputedStyle(state.modal || document.documentElement);
            ['--tm-bg-color', '--tm-header-bg', '--tm-text-color', '--tm-secondary-text', '--tm-border-color', '--tm-primary-color', '--tm-danger-color'].forEach(key => popup.style.setProperty(key, theme.getPropertyValue(key)));
            q('[data-cancel]')?.addEventListener('click', closePopup);
            const first = q('input,select,button');first?.focus({ preventScroll: true });
            return popup;
        }
        const cancelButton = '<button type="button" class="b3-button b3-button--cancel" data-cancel>取消</button>';
        const saveButton = label => `<button type="button" class="b3-button" data-save>${label}</button>`;
        function optionHtml(options, selected, missingLabel) {
            const list = options.slice();
            if (!list.some(option => option.id === selected)) list.unshift({ id: selected, name: `已失效：${missingLabel || selected}`, disabled: true });
            return list.map(option => `<option value="${esc(option.id)}" ${option.disabled ? 'disabled' : ''} ${option.id === selected ? 'selected' : ''}>${esc(option.name)}</option>`).join('');
        }
        async function edit(item = null) {
            await __tmEnsureFilterRulesLoaded();
            const current = __tmShortcuts.context();
            const draft = item ? { ...item, icon: { ...item.icon } } : {
                id: '', name: '', icon: { type: 'phosphor', name: 'star' }, groupId: SettingsStore.data.currentGroupId || 'all',
                tabGroupId: current?.tabGroupId || __tmParseDocTabCustomGroupActiveId(state.activeDocId) || '',
                docId: __tmIsDocTabCustomGroupActiveId(state.activeDocId) ? 'all' : state.activeDocId || 'all',
                viewId: state.homepageOpen ? 'home' : state.viewMode || 'checklist', ruleId: String(state.currentRule || ''),
                groupMode: __tmGetCurrentGroupModeValue(), kanbanBoardMode: __tmGetKanbanBoardMode(), targetNames: {} };
            const labels = __tmShortcuts.names(draft);
            const root = showPopup(item ? '编辑快捷项' : '新建快捷项', `
                <div class="tm-shortcut-name-fields"><label>图标<button type="button" class="tm-shortcut-icon-select" data-icon-toggle aria-label="选择快捷项图标" aria-expanded="false">${iconHtml(draft.icon)}</button></label><label>名称<input class="b3-text-field" data-field="name" maxlength="32" placeholder="例如：今天" value="${esc(draft.name)}"></label></div>
                <div class="tm-shortcut-icon-picker" hidden><div class="tm-shortcut-icon-sources"><button type="button" data-phosphor>内置图标</button><button type="button" data-emoji>思源 Emoji</button></div><input class="b3-text-field" data-icon-search placeholder="搜索中文或英文名称" aria-label="搜索图标"><div class="tm-shortcut-icon-grid"></div></div>
                <p class="tm-shortcut-hint">以下配置仅用于此快捷项，不修改分组或页签组默认设置。</p>
                <label>文档分组<select class="b3-select" data-field="groupId">${optionHtml(__tmShortcuts.groups(), draft.groupId, labels.group)}</select></label>
                <label data-tab-field>页签组<select class="b3-select" data-field="tabGroupId"></select></label>
                <label>文档页签<select class="b3-select" data-field="docId"></select></label>
                <label>视图<select class="b3-select" data-field="viewId">${optionHtml([{ id: 'home', name: '首页' }, ...__TM_ALL_VIEWS.filter(view => __tmIsViewEnabled(view.id)).map(view => ({ id: view.id, name: view.label }))], draft.viewId, labels.view)}</select></label>
                <label data-kanban-field hidden>看板模式<select class="b3-select" data-field="kanbanBoardMode">${optionHtml([
                    { id: '', name: '保持当前看板模式' }, { id: 'heading', name: '标题' }, { id: 'time', name: '时间' }, { id: 'status', name: '状态' }, { id: 'quadrant', name: '四象限' }
                ], draft.kanbanBoardMode || '')}</select></label>
                <label>任务分组<select class="b3-select" data-field="groupMode">${optionHtml([
                    { id: '', name: '保持当前分组' }, ...['none', 'doc', 'time', 'quadrant', 'task']
                        .map(id => ({ id, name: id === 'quadrant' && draft.viewId === 'kanban' && draft.kanbanBoardMode === 'quadrant' ? '四象限（看板已固定）' : __tmGetGroupModeLabel(id), disabled: id === 'quadrant' && draft.viewId === 'kanban' && draft.kanbanBoardMode === 'quadrant' }))
                ], draft.groupMode || '')}</select></label>
                <p class="tm-shortcut-hint" data-group-hint hidden>当前视图不使用任务分组。</p>
                <label>筛选规则<select class="b3-select" data-field="ruleId">${optionHtml([{ id: '', name: '不应用规则' }, ...__tmShortcuts.rules().filter(rule => rule.enabled !== false)], draft.ruleId, labels.rule)}</select></label>
                <p class="tm-shortcut-status" role="status"></p><p class="tm-shortcut-path"></p>`,
                `${item ? '<button type="button" class="b3-button b3-button--cancel tm-shortcut-delete" data-delete>删除</button>' : ''}${cancelButton}${saveButton('保存并打开')}`);
            let loading = false, documentError = '', currentDocs = [], saving = false;
            const field = name => q(`[data-field="${name}"]`, root);
            const sync = () => {
                for (const key of ['name', 'groupId', 'tabGroupId', 'docId', 'viewId', 'kanbanBoardMode', 'groupMode', 'ruleId']) draft[key] = field(key).value.trim();
                if (draft.viewId === 'kanban' && draft.kanbanBoardMode === 'quadrant' && draft.groupMode === 'quadrant') draft.groupMode = 'none';
                const groupModeSelect = field('groupMode');
                if (groupModeSelect) {
                    groupModeSelect.innerHTML = optionHtml([
                        { id: '', name: '保持当前分组' }, ...['none', 'doc', 'time', 'quadrant', 'task']
                            .map(id => ({ id, name: id === 'quadrant' && draft.viewId === 'kanban' && draft.kanbanBoardMode === 'quadrant' ? '四象限（看板已固定）' : __tmGetGroupModeLabel(id), disabled: id === 'quadrant' && draft.viewId === 'kanban' && draft.kanbanBoardMode === 'quadrant' }))
                    ], draft.groupMode || '');
                }
                q('[data-kanban-field]', root).hidden = draft.viewId !== 'kanban';
                const usesGrouping = draft.viewId !== 'home';
                field('groupMode').disabled = !usesGrouping;
                const groupHint = q('[data-group-hint]', root);
                groupHint.textContent = draft.viewId === 'calendar' ? '用于日历侧栏的任务清单分组。' : '当前视图不使用任务分组。';
                groupHint.hidden = usesGrouping && draft.viewId !== 'calendar';
                const issues = __tmShortcuts.issues(draft);
                if (!loading && draft.docId !== 'all' && !currentDocs.some(doc => doc.id === draft.docId)) issues.push('文档已删除或不在所选范围，请重新选择');
                const message = documentError || issues.join('；');
                q('.tm-shortcut-status', root).textContent = loading ? '正在加载文档…' : message;
                q('[data-save]', root).disabled = saving || loading || !draft.name || !!message;
                const names = __tmShortcuts.names(draft);
                q('.tm-shortcut-path', root).textContent = [names.group, ...(draft.tabGroupId ? [names.tabGroup] : []), names.doc, names.view,
                    ...(draft.viewId === 'kanban' ? [names.kanbanBoardMode] : []), names.groupMode, names.rule].join(' → ');
            };
            const targets = async (changed = false) => {
                draft.groupId = field('groupId').value;
                if (changed) draft.tabGroupId = '';
                const tabs = __tmShortcuts.tabGroups(draft.groupId);
                q('[data-tab-field]', root).hidden = !tabs.length && !draft.tabGroupId;
                field('tabGroupId').innerHTML = optionHtml([{ id: '', name: '不限定页签组' }, ...tabs], draft.tabGroupId, labels.tabGroup);
                if (changed) draft.docId = 'all';
                field('docId').innerHTML = optionHtml([{ id: 'all', name: '全部页签' }], draft.docId, labels.doc);
                const request = ++optionRequest;loading = true;documentError = '';sync();
                try {
                    const docs = await __tmShortcuts.documents(draft.groupId, field('tabGroupId').value, true);
                    if (request !== optionRequest || !root.isConnected) return;
                    currentDocs = docs;field('docId').innerHTML = optionHtml([{ id: 'all', name: '全部页签' }, ...docs], draft.docId, labels.doc);
                } catch (error) { if (request === optionRequest) documentError = '文档加载失败，请重新选择分组重试'; }
                if (request === optionRequest && root.isConnected) { loading = false;sync(); }
            };
            root.addEventListener('input', event => { if (event.target.matches('[data-field="name"]')) sync(); });
            root.addEventListener('change', event => {
                if (event.target === field('groupId')) void targets(true);
                else if (event.target === field('tabGroupId')) { draft.tabGroupId = field('tabGroupId').value;draft.docId = 'all';void targets(); }
                else sync();
            });
            const picker = q('.tm-shortcut-icon-picker', root);
            const renderPresets = () => {
                const terms = q('[data-icon-search]', root).value.toLowerCase().trim().split(/\s+/).filter(Boolean);
                const matches = presets.filter(preset => terms.every(term => `${preset.name} ${preset.label}`.toLowerCase().includes(term)));
                q('.tm-shortcut-icon-grid', root).innerHTML = matches.map(preset => `<button type="button" data-icon-name="${preset.name}" title="${esc(preset.label)}" aria-label="${esc(preset.label)}" aria-pressed="${draft.icon.type === 'phosphor' && draft.icon.name === preset.name}">${iconHtml({ name: preset.name })}</button>`).join('') || '<p class="tm-shortcut-hint">没有匹配的图标</p>';
            };
            q('[data-icon-toggle]', root).onclick = () => { picker.hidden = !picker.hidden;q('[data-icon-toggle]', root).setAttribute('aria-expanded', String(!picker.hidden));if (!picker.hidden) { renderPresets();q('[data-icon-search]', root).focus(); } };
            q('[data-phosphor]', root).onclick = renderPresets;q('[data-icon-search]', root).oninput = renderPresets;
            const setIcon = value => { draft.icon = value;q('[data-icon-toggle]', root).innerHTML = iconHtml(value);picker.hidden = true;q('[data-icon-toggle]', root).setAttribute('aria-expanded', 'false');q('[data-icon-toggle]', root).focus(); };
            q('.tm-shortcut-icon-grid', root).onclick = event => { const name = event.target.closest('[data-icon-name]')?.dataset.iconName;if (name) setIcon({ type: 'phosphor', name }); };
            q('[data-emoji]', root).onclick = () => {
                const openEmoji = globalThis.__tmHost?.getBridge?.()?.openEmoji;
                if (!openEmoji) { hint('当前思源版本未提供图标选择器', 'warning');return; }
                const anchor = q('[data-icon-toggle]', root), rect = anchor.getBoundingClientRect();
                openEmoji({ position: { x: rect.left, y: rect.top, w: rect.width, h: rect.height, target: anchor },
                    selectedCB: value => { if (root.isConnected && popup === root) setIcon(value ? { type: 'siyuan', value } : { type: 'phosphor', name: 'star' }); } });
            };
            q('[data-save]', root).onclick = async () => {
                sync();if (q('[data-save]', root).disabled) return;saving = true;sync();
                draft.id ||= `shortcut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
                draft.targetNames = __tmShortcuts.names(draft);
                const list = __tmShortcuts.items(), index = list.findIndex(entry => entry.id === draft.id);
                if (index === -1) list.push(draft);else list[index] = draft;
                try { await __tmShortcuts.save(list);if (popup !== root) return;closePopup();await __tmShortcuts.open(draft.id); }
                catch (error) { saving = false;sync();q('.tm-shortcut-status', root).textContent = `保存失败：${error.message}`; }
            };
            if (item) q('[data-delete]', root).onclick = async () => {
                try {
                    await __tmShortcuts.save(__tmShortcuts.items().filter(entry => entry.id !== item.id));
                    closePopup();hint('快捷项已删除', 'success');
                } catch (error) { q('.tm-shortcut-status', root).textContent = `删除失败：${error.message}`; }
            };
            void targets();
        }
        function showInvalid(item, issues) {
            const root = showPopup('快捷项暂时无法打开', `<strong>${esc(item.name)}</strong><ul>${issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul><p class="tm-shortcut-hint">原配置已保留，当前页面不会切换。</p>`, `${cancelButton}<button type="button" class="b3-button" data-repair>重新关联</button>`);
            q('[data-repair]', root).onclick = () => { closePopup();void edit(item); };
        }
        function sort() {
            let order = __tmShortcuts.items().map(item => item.id), dragged = '';
            const original = order.join('|');
            const root = showPopup('快捷项排序', '<p class="tm-shortcut-hint">拖动整行，或使用上下按钮调整。Alt + ↑ / ↓ 可移动当前项。</p><div class="tm-shortcut-sort-list"></div><p class="tm-shortcut-status" role="status"></p>', `${cancelButton}${saveButton('保存排序')}`, '520px');
            const renderRows = focusId => {
                const items = __tmShortcuts.items();
                q('.tm-shortcut-sort-list', root).innerHTML = order.map((id, index) => {
                    const item = items.find(entry => entry.id === id);
                    return item ? `<div class="tm-shortcut-sort-row" data-sort-id="${esc(id)}" draggable="true" tabindex="0"><span>${index + 1}</span>${iconHtml(item.icon)}<span class="tm-shortcut-name">${esc(item.name)}</span><button type="button" data-move="-1" aria-label="上移${esc(item.name)}" ${index === 0 ? 'disabled' : ''}>${glyph('arrow-up')}</button><button type="button" data-move="1" aria-label="下移${esc(item.name)}" ${index === order.length - 1 ? 'disabled' : ''}>${glyph('arrow-down')}</button></div>` : '';
                }).join('') || '<p class="tm-shortcut-hint">暂无快捷项，请先新增。</p>';
                q('[data-save]', root).disabled = order.join('|') === original;
                if (focusId) [...root.querySelectorAll('[data-sort-id]')].find(row => row.dataset.sortId === focusId)?.focus({ preventScroll: true });
            };
            const move = (id, delta) => { const index = order.indexOf(id), to = index + delta;if (to < 0 || to >= order.length) return;order.splice(index, 1);order.splice(to, 0, id);renderRows(id); };
            root.onclick = event => { const action = event.target.closest('[data-move]'), row = event.target.closest('[data-sort-id]');if (action && row) move(row.dataset.sortId, Number(action.dataset.move)); };
            root.onkeydown = event => { const row = event.target.closest('[data-sort-id]');if (row && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault();move(row.dataset.sortId, event.key === 'ArrowUp' ? -1 : 1); } };
            root.ondragstart = event => { dragged = event.target.closest('[data-sort-id]')?.dataset.sortId || '';event.dataTransfer.setData('text/plain', dragged); };
            root.ondragover = event => { if (event.target.closest('[data-sort-id]')) event.preventDefault(); };
            root.ondrop = event => { const target = event.target.closest('[data-sort-id]')?.dataset.sortId;if (!dragged || !target) return;event.preventDefault();const from = order.indexOf(dragged), to = order.indexOf(target);if (from >= 0 && to >= 0) { order.splice(from, 1);order.splice(to, 0, dragged);renderRows(dragged); }dragged = ''; };
            q('[data-save]', root).onclick = async () => {
                q('[data-save]', root).disabled = true;
                const items = __tmShortcuts.items(), reordered = order.map(id => items.find(item => item.id === id)).filter(Boolean);
                reordered.push(...items.filter(item => !order.includes(item.id)));
                try { await __tmShortcuts.save(reordered);closePopup(); }
                catch (error) { q('.tm-shortcut-status', root).textContent = `保存失败：${error.message}`;q('[data-save]', root).disabled = false; }
            };
            renderRows();
        }
        function dispose() {
            edgeDragging = false;
            closePopup();closeHideGuide(false);hideName();closeDrawer(false);
            globalThis.__tmDateFilter?.dispose();
            observer?.disconnect();observer = null;clearTimeout(scrollTimer);clearTimeout(countTimer);countGeneration++;unsubscribe?.();unsubscribe = null;window.removeEventListener('tm:filtered-tasks-updated', scheduleCounts);sidebar?.remove();sidebar = null;layout = null;
        }
        function syncEnabled() {
            const modal = state.modal;
            if (SettingsStore.data.shortcutSidebarEnabled === false) {
                const wrapper = modal?.querySelector('.tm-shortcut-layout');
                const content = wrapper?.querySelector(':scope > .tm-main-stage');
                const bottomBar = wrapper?.querySelector(':scope > .tm-mobile-bottom-viewbar');
                dispose();
                if (content) { content.inert = false;wrapper.replaceWith(...[content, bottomBar].filter(Boolean)); }
            } else if (modal?.isConnected && !modal.querySelector('.tm-shortcut-layout')) mount(modal);
        }
        return { mount, refresh, closeDrawer, showInvalid, edit, dispose, syncEnabled, iconHtml };
    })();
