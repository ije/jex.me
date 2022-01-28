window.addEventListener("load", () => {
  document.body.innerHTML = `<div class="loading">Loading...</div>`
  fetchShader("world").then(pixelShaderSource => {
    const canvas = document.createElement("canvas")

    canvas.setAttribute("width", window.innerWidth)
    canvas.setAttribute("height", window.innerHeight)
    Object.assign(canvas.style, { width: "100vw", height: "100vh" })
    document.body.removeChild(document.querySelector(".loading"))
    document.body.appendChild(canvas)

    try {
      const gl = canvas.getContext("webgl")
      if (gl) {
        hot(gl)
        glMain(gl, pixelShaderSource)
      } else {
        error("Your browser does not support WebGL.")
      }
    } catch (err) {
      console.error(err)
    }
  }).catch(() => {
    error("Could not load the shader source.")
  })
})

function hot(gl) {
  if (window.IS_DEV) {
    const socket = new WebSocket("ws://localhost:8000/dev-socket")
    socket.addEventListener("open", () => {
      socket.send("READY")
    })
    socket.addEventListener("message", e => {
      switch (e.data) {
        case "RELOAD":
          window.location.reload()
          break
        case "REDRAW":
          fetchShader("world", true).then(pixelShaderSource => {
            glMain(gl, pixelShaderSource)
          })
      }
    })
  }
}

function error(message) {
  document.body.innerHTML = `<div class="error">${message}</div>`
}

function now() {
  return window.performance?.now() || Date.now()
}

function fetchShader(name, force) {
  const url = [`/${name}.glsl`, force ? Date.now() : window.DEPLOY].filter(Boolean).join("?v=")
  return fetch(url).then(res => res.text())
}

// Vertex shader program (two-dimensional rectangle with same size as the canvas)
const vsSource = `
  attribute vec2 pos;
  void main() {
    gl_Position = vec4(pos.xy, 0.0, 1.0);
  }
`;
const vsPoints = new Float32Array([
  1.0, 1.0,
  -1.0, 1.0,
  1.0, -1.0,
  -1.0, -1.0,
])
const pixelShaderHeader = `
#ifdef GL_ES
precision highp float;
precision highp int;
#endif
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform vec3 iScroll;
uniform float iTime;
`

let mousePosX = 0.0
let mousePosY = 0.0
let mouseLeftDown = false
let mouseRightDown = false
let scrollX = 0.0
let scrollY = 0.0
let scrollZ = 0.0

// todo: add mouse and scroll events

function glMain(gl, pixelShaderSource) {
  const shaderProgram = initShaderProgram(gl, pixelShaderSource)

  if (shaderProgram) {
    draw(gl, shaderProgram)
  }
}

function draw(gl, shaderProgram, startTime = now()) {
  // Clear the canvas before we start drawing on it.
  gl.clearColor(0.0, 0.0, 0.0, 0.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute.
  const positionBuffer = gl.createBuffer()
  const vertexPosition = gl.getAttribLocation(shaderProgram, "pos")
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vsPoints, gl.STATIC_DRAW)
  gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(vertexPosition)

  // Tell WebGL to use our program when drawing
  gl.useProgram(shaderProgram)

  gl.uniform3f(gl.getUniformLocation(shaderProgram, "iResolution"), window.innerWidth, window.innerHeight, 1.0)
  gl.uniform4fv(gl.getUniformLocation(shaderProgram, "iMouse"), new Float32Array([mousePosX, mousePosY, mouseLeftDown ? 1.0 : 0.0, mouseRightDown ? 1.0 : 0.0]))
  gl.uniform3f(gl.getUniformLocation(shaderProgram, "iScroll"), scrollX, scrollY, scrollZ)
  gl.uniform1f(gl.getUniformLocation(shaderProgram, "iTime"), (startTime - now()) / 1000.0)

  // Draw the rectangle.
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  gl.disableVertexAttribArray(vertexPosition);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  requestAnimationFrame(() => draw(gl, shaderProgram, startTime))
}

function initShaderProgram(gl, pixelShaderSource) {
  const shaderProgram = gl.createProgram()
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vsSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, pixelShaderHeader + pixelShaderSource)

  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    error("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram))
    return null
  }

  return shaderProgram
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type)

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    window.shaderError = true
    error(`<strong>An error occurred compiling the shader:</strong><pre>${gl.getShaderInfoLog(shader)}</pre>`)
    gl.deleteShader(shader)
    return null
  }

  return shader
}
