#define TMAX 20.0
#define AA 3

uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform vec3 iScroll;

out vec4 fragColor;

vec2 toUV(in vec2 coord) {
  return (2.0 * coord - iResolution.xy) / min(max(500.0, iResolution.y), 1000.0);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

vec2 minX(in vec2 a, in vec2 b) {
  return (a.x < b.x) ? a : b;
}

vec2 map(in vec3 p) {
  vec2 d = vec2(sdBox(p - vec3(0, 0, -0.1), vec3(0.2)), 1.0);
  return d;
}

// https://www.iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal(in vec3 p) {
  const float h = 0.0001;
  const vec2 k = vec2(1, -1);
  return normalize(k.xyy * map(p + k.xyy * h).x +
    k.yyx * map(p + k.yyx * h).x +
    k.yxy * map(p + k.yxy * h).x +
    k.xxx * map(p + k.xxx * h).x);
}

vec2 rayMatch(in vec3 ro, in vec3 rd) {
  float t = 0.1;
  float target = -1.0;
  for(int i = 0; i < 100; i++) {
    if(t >= TMAX) {
      break;
    }
    vec3 p = ro + rd * t;
    vec2 d = map(p);
    if(d.x < 0.0001) {
      target = d.y;
      break;
    }
    t += d.x;
  }
  return vec2(t, target);
}

vec3 render(in vec2 uv) {
  vec3 ro = vec3(0, 0, -2);
  vec3 rd = normalize(vec3(uv, 0) - ro);
  vec2 t = rayMatch(ro, rd);
  vec3 color = vec3(1);
  if(t.x < TMAX) {
    vec3 p = ro + rd * t.x;
    vec3 n = calcNormal(p);
    vec3 light = vec3(2.0 * sin(iTime), 2.0, 2.0 * cos(iTime));
    float dif = clamp(dot(normalize(light - p), n), 0.0, 1.0);
    float amd = 0.5 + 0.5 * dot(n, vec3(0, 1, 0));
    color = amd * (0.5 + 0.4 * cos(iTime + uv.yxx + vec3(0, 2, 4))) + dif * vec3(0.9);
  }
  return sqrt(color);
}

void main() {
  vec3 color = vec3(0);
  for(int m = 0; m < AA; m++) {
    for(int n = 0; n < AA; n++) {
      vec2 offset = (vec2(float(m), float(n)) / float(AA) - 0.5);
      vec2 uv = toUV(gl_FragCoord.xy + offset);
      color += render(uv);
    }
  }
  fragColor = vec4(color / float(AA * AA), 1.0);
}
