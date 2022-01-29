function main() {
  let iMouse = new Float32Array([-1, -1, 0, 0])
  let iScroll = [0, 0, 0]
  let currentShaderProgram = null

  window.addEventListener("load", () => {
    const { body } = document
    body.innerHTML = `<div class="loading">Loading...</div>`

    loadShader("world").then(pixelShaderSource => {
      const canvas = document.createElement("canvas")

      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      body.childNodes.forEach(node => node.remove())
      body.appendChild(canvas)

      try {
        const gl = canvas.getContext("webgl")
        if (gl) {
          window.addEventListener("resize", () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
            gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight)
          })
          canvas.addEventListener("mousemove", e => {
            iMouse[0] = e.clientX
            iMouse[1] = window.innerHeight - e.clientY
          })
          canvas.addEventListener("mousedown", e => {
            if (e.button === 2) {
              iMouse[3] = 1  // right click 
            } else {
              iMouse[2] = 1
            }
          })
          canvas.addEventListener("mouseup", () => {
            iMouse[2] = iMouse[3] = 0
          })
          canvas.addEventListener("contextmenu", e => {
            e.preventDefault()
          })
          body.addEventListener("wheel", e => {
            iScroll[0] += e.deltaX
            iScroll[1] += e.deltaY
          })
          if (window.IS_DEV) {
            hot(gl)
          }
          render(gl, pixelShaderSource)
        } else {
          error("Your browser does not support WebGL.")
        }
      } catch (err) {
        console.error(err)
      }
    }).catch(err => {
      error(err.message)
    })
  })

  function render(gl, pixelShaderSource) {
    if (currentShaderProgram = initShaderProgram(gl, pixelShaderSource)) {
      draw(gl, currentShaderProgram)
    }
  }

  function draw(gl, shaderProgram, startTime = now()) {
    const currentTime = now()

    // clear the screen
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // use the shader program before setting uniforms
    gl.useProgram(shaderProgram)

    // Set the vertex coordinates
    const positionBuffer = gl.createBuffer()
    const vertexPosition = gl.getAttribLocation(shaderProgram, "pos")
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1,]), gl.STATIC_DRAW)
    gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(vertexPosition)

    // Set the shader uniforms
    gl.uniform3f(gl.getUniformLocation(shaderProgram, "iResolution"), gl.canvas.clientWidth, gl.canvas.clientHeight, 1)
    gl.uniform4fv(gl.getUniformLocation(shaderProgram, "iMouse"), iMouse)
    gl.uniform3f(gl.getUniformLocation(shaderProgram, "iScroll"), ...iScroll)
    gl.uniform1f(gl.getUniformLocation(shaderProgram, "iTime"), (currentTime - startTime) / 1000)

    // draw the rectangle
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // animate
    requestAnimationFrame(() => {
      if (window.IS_DEV) {
        updateFPS(Math.round(1000 / (now() - currentTime)))
      }
      if (currentShaderProgram === shaderProgram) {
        draw(gl, shaderProgram, startTime)
      }
    })
  }

  const pixelShaderHeader = `
    #ifdef GL_ES
      precision highp float;
      precision highp int;
    #endif
  `

  function initShaderProgram(gl, pixelShaderSource) {
    const shaderProgram = gl.createProgram()
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, "attribute vec2 pos;void main(){gl_Position=vec4(pos.xy,0.,1.);}")
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `${pixelShaderHeader}${pixelShaderSource}`)

    if (!fragmentShader) {
      return null
    }

    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      error(`<strong>Unable to initialize the shader program: </strong><pre>${gl.getProgramInfoLog(shaderProgram)}</pre>`)
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

  function hot(gl) {
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
          loadShader("world", true).then(pixelShaderSource => {
            document.querySelector(".error")?.remove()
            render(gl, pixelShaderSource)
          })
      }
    })
  }

  function updateFPS(fps) {
    const firstUp = typeof window._fpsUpWait === "undefined"
    window._fps = fps
    if (window._fpsUpWait) {
      return
    }
    window._fpsUpWait = true
    setTimeout(() => {
      let fpsEl = window.fpsEl
      if (!fpsEl) {
        fpsEl = window.fpsEl = document.createElement("div")
        fpsEl.className = "fps"
        document.body.appendChild(fpsEl)
      }
      fpsEl.innerText = window._fps.toString()
      window._fpsUpWait = false
    }, firstUp ? 100 : 1000)
  }

  function error(message) {
    let div = document.querySelector(".error")
    if (!div) {
      div = document.createElement("div")
      div.className = "error"
      document.body.appendChild(div)
    }
    div.innerHTML = `<div class="wrapper">${message}</div>`
  }

  function now() {
    return window.performance?.now() || Date.now()
  }

  function loadShader(name, noCache = false) {
    const url = [`/${name}.glsl`, noCache ? now() : window.DEPLOY].filter(Boolean).join("?v=")
    return fetch(url).then(res => {
      if (res.status >= 400) {
        return Promise.reject(new Error(`<${res.status}> Could not load the shader source.`))
      }
      return res.text()
    })
  }
}

main()
