// src/components/MapComponent/CrosshairManager.js

export default class CrosshairManager {
    constructor(map) {
        this.map = map;
        this.width = 0;
        this.height = 0;
        this.svgCanvas = null;
        this.xLine = null;
        this.yLine = null;
    }
    create() {
        if (!this.map) return;
        this.updateValues();
        this.map.on("resize", this.onResize);
        this.createCanvas(this.map.getCanvasContainer());
    }
    destroy() {
        if (this.svgCanvas) this.svgCanvas.remove();
        this.svgCanvas = null;
        if (this.map) this.map.off("resize", this.onResize);
    }
    onResize = () => {
        this.updateValues();
        this.updateCanvas();
    };
    updateValues() {
        const canvas = this.map.getCanvas();
        this.width = canvas.clientWidth;
        this.height = canvas.clientHeight;
    }
    createCanvas(container) {
        this.svgCanvas = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );
        Object.assign(this.svgCanvas.style, { position: "absolute", top: 0, left: 0 });
        this.svgCanvas.setAttribute("width", `${this.width}px`);
        this.svgCanvas.setAttribute("height", `${this.height}px`);

        const halfW = this.width / 2;
        const halfH = this.height / 2;
        this.yLine = this.createLine(halfW, 0, halfW, this.height);
        this.xLine = this.createLine(0, halfH, this.width, halfH);
        this.svgCanvas.append(this.yLine, this.xLine);
        container.appendChild(this.svgCanvas);
    }
    updateCanvas() {
        if (!this.svgCanvas) return;
        this.svgCanvas.setAttribute("width", `${this.width}px`);
        this.svgCanvas.setAttribute("height", `${this.height}px`);
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        this.yLine.setAttribute("x1", halfW);
        this.yLine.setAttribute("y2", this.height);
        this.xLine.setAttribute("y1", halfH);
        this.xLine.setAttribute("x2", this.width);
    }
    createLine(x1,y1,x2,y2) {
        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke-dasharray", "4,4");
        line.setAttribute("stroke", "#111");
        line.setAttribute("stroke-width", "2");
        return line;
    }
}