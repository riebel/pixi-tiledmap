function createCanvas2dContextStub(): Partial<CanvasRenderingContext2D> {
  return {
    canvas: document.createElement('canvas'),
    clearRect() {},
    drawImage() {},
    fillRect() {},
    getImageData() {
      return new ImageData(1, 1)
    },
    measureText(text: string) {
      return { width: text.length * 10 } as TextMetrics
    },
    putImageData() {},
    restore() {},
    save() {},
    scale() {},
    setTransform() {},
    transform() {},
    translate() {}
  }
}

if (typeof HTMLCanvasElement !== 'undefined') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value(contextId: string) {
      if (contextId === '2d') return createCanvas2dContextStub()
      return null
    }
  })
}
