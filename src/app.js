const { body } = document;
const loadingEl = el("div", "loading", "Loading...");

let currentShaderProgram = null;
let iMouse = new Float32Array([-1, -1, 0, 0]);
let iScroll = [0, 0, 0];
let currentFPS = -1;
let fpsUpWait = null;

Promise.all([
  loadShader("world"),
]).then(([
  pixelShaderSource,
]) => {
  const canvas = document.querySelector("canvas");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  loadingEl.remove();

  try {
    const gl = canvas.getContext("webgl2");
    if (gl) {
      gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
      window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
      });
      canvas.addEventListener("mousemove", (e) => {
        iMouse[0] = e.clientX;
        iMouse[1] = window.innerHeight - e.clientY;
      });
      canvas.addEventListener("mousedown", (e) => {
        if (e.button === 2) {
          iMouse[3] = 1; // right click
        } else {
          iMouse[2] = 1;
        }
      });
      canvas.addEventListener("mouseup", () => {
        iMouse[2] = iMouse[3] = 0;
      });
      canvas.addEventListener("contextmenu", (e) => {
        e.preventDefault();
      });
      body.addEventListener("wheel", (e) => {
        iScroll[0] += e.deltaX;
        iScroll[1] += e.deltaY;
      });
      render(gl, pixelShaderSource);
    } else {
      error("Your browser does not support WebGL2.");
    }
  } catch (err) {
    console.error(err);
  }
}).catch((err) => {
  error(err.message);
});

function render(gl, pixelShaderSource) {
  currentShaderProgram = initShaderProgram(gl, pixelShaderSource);
  if (currentShaderProgram) {
    draw(gl, currentShaderProgram);
  }
}

function draw(gl, shaderProgram, startTime = now()) {
  const currentTime = now();

  // clear the screen
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // use the shader program before setting uniforms
  gl.useProgram(shaderProgram);

  // Set the vertex coordinates
  const positionBuffer = gl.createBuffer();
  const vertexPosition = gl.getAttribLocation(shaderProgram, "pos");
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]),
    gl.STATIC_DRAW,
  );
  gl.vertexAttribPointer(vertexPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vertexPosition);

  // Set the shader uniforms
  gl.uniform3f(
    gl.getUniformLocation(shaderProgram, "iResolution"),
    gl.canvas.clientWidth,
    gl.canvas.clientHeight,
    1,
  );
  gl.uniform4fv(gl.getUniformLocation(shaderProgram, "iMouse"), iMouse);
  gl.uniform3f(gl.getUniformLocation(shaderProgram, "iScroll"), ...iScroll);
  gl.uniform1f(
    gl.getUniformLocation(shaderProgram, "iTime"),
    (currentTime - startTime) / 1000,
  );

  // draw the rectangle
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // animate
  requestAnimationFrame(() => {
    if (window.IS_DEV) {
      updateFPS(Math.round(1000 / (now() - currentTime)));
    }
    if (currentShaderProgram === shaderProgram) {
      draw(gl, shaderProgram, startTime);
    }
  });
}

const pixelShaderHeader = `
    #ifdef GL_ES
    precision highp float;
    precision highp int;
    #endif
  `;

function initShaderProgram(gl, pixelShaderSource) {
  const shaderProgram = gl.createProgram();
  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    "#version 300 es\nlayout(location = 0) in vec2 pos;\nvoid main() { gl_Position = vec4(pos.xy,0.,1.); }",
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es${pixelShaderHeader}${pixelShaderSource}`,
  );

  if (!fragmentShader) {
    return null;
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    error(
      `<strong>Unable to initialize the shader program: </strong><pre>${
        gl.getProgramInfoLog(shaderProgram)
      }</pre>`,
    );
    return null;
  }

  return shaderProgram;
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    window.shaderError = true;
    error(
      `<strong>An error occurred compiling the shader:</strong><pre>${
        gl.getShaderInfoLog(shader)
      }</pre>`,
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function updateFPS(fps) {
  const firstUp = fpsUpWait === null;
  currentFPS = fps;
  if (fpsUpWait) {
    return;
  }
  fpsUpWait = true;
  setTimeout(() => {
    const e = document.querySelector(".fps") || el("div", "fps");
    e.innerHTML = currentFPS.toString();
    fpsUpWait = false;
  }, firstUp ? 100 : 1000);
}

function el(name, className, innerHTML) {
  const e = document.createElement(name);
  e.className = className;
  if (innerHTML) {
    e.innerHTML = innerHTML;
  }
  body.appendChild(e);
  return e;
}

function error(message) {
  const e = document.querySelector(".error") || el("div", "error");
  e.innerHTML = `<div class="wrapper">${message}</div>`;
}

function now() {
  return window.performance?.now() || Date.now();
}

function loadShader(name, noCache = false) {
  const url = [`/src/${name}.glsl`, noCache ? now() : window.DEPLOY].filter(
    Boolean,
  ).join("?v=");
  return fetch(url).then((res) => {
    if (res.status >= 400) {
      return Promise.reject(
        new Error(`<${res.status}> Could not load the shader source.`),
      );
    }
    return res.text();
  });
}

import.meta.hot?.decline();
