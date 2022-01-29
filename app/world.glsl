#define TMAX 20.0
#define AA 3

uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform vec3 iScroll;

vec2 toUV(in vec2 c) {
  return (2.0 * c - iResolution.xy) / min(iResolution.x, iResolution.y);
}

float sdfSphere(in vec3 p, in float r) {
  return length(p) - r;
}

float map(in vec3 p) {
  float d = sdfSphere(p - vec3(0, 0, 1), 0.5);
  return d;
}

// https://www.iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal(in vec3 p) {
  const float h = 0.0001;
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * h) +
    k.yyx * map(p + k.yyx * h) +
    k.yxy * map(p + k.yxy * h) +
    k.xxx * map(p + k.xxx * h));
}

float rayMatch(in vec3 ro, in vec3 rd) {
  float t = 0.1;
  for(int i = 0; i < 100; i++) {
    if(t >= TMAX) {
      break;
    }
    vec3 p = ro + rd * t;
    float d = map(p);
    if(d < 0.0001) {
      break;
    }
    t += d;
  }
  return t;
}

vec3 render(in vec2 uv) {
  vec3 ro = vec3(0, 0, -2);
  vec3 rd = normalize(vec3(uv, 0) - ro);
  float t = rayMatch(ro, rd);
  vec3 color = vec3(0);
  if(t < TMAX) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 light = vec3(2.0 * sin(iTime), 2.0, 2.0 * cos(iTime));
    float dif = clamp(dot(normalize(light - p), n), 0.0, 1.0);
    float amd = 0.5 + 0.5 * dot(n, vec3(0, 1, 0));
    color = amd * (0.5 + 0.4 * cos(iTime + uv.yxx + vec3(0, 2, 4))) + dif * vec3(1);
  }
  return sqrt(color);
}

void main() {
  vec3 color = vec3(0.0);
  for(int m = 0; m < AA; m++) {
    for(int n = 0; n < AA; n++) {
      vec2 offset = (vec2(float(m), float(n)) / float(AA) - 0.5);
      vec2 uv = toUV(gl_FragCoord.xy + offset);
      vec3 ro = vec3(0, 0, -2);
      vec3 rd = normalize(vec3(uv, 0) - ro);
      float t = rayMatch(ro, rd);
      vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
      color += mix(col, render(uv), smoothstep(TMAX + 0.001, TMAX, t));
    }
  }
  gl_FragColor = vec4(color / float(AA * AA), 1.0);
}
