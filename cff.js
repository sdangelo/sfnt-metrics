/*
 * Copyright (C) 2017 Stefano D'Angelo <zanga.mail@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

function getMetrics(font, glyph) {
	function updateBBox (xm, xM, ym, yM) {
		if ("xMin" in glyph) {
			glyph.xMin = Math.min(glyph.xMin, xm);
			glyph.xMax = Math.max(glyph.xMax, xM);
			glyph.yMin = Math.min(glyph.yMin, ym);
			glyph.yMax = Math.max(glyph.yMax, yM);
		} else {
			glyph.xMin = xm;
			glyph.xMax = xM;
			glyph.yMin = ym;
			glyph.yMax = yM;
		}
	}

	var x = 0, y = 0;

	function lineTo (dx, dy)  {
		var nx = x + dx;
		var ny = y + dy;
		var xm, xM, ym, yM;
		if (dx > 0) {
			xm = x;
			xM = nx;
		} else {
			xm = nx;
			xM = x;
		}
		if (dy > 0) {
			ym = y;
			yM = ny;
		} else {
			ym = ny;
			yM = y;
		}

		updateBBox(xm, xM, ym, yM);

		x = nx;
		y = ny;
	}

	function curveTo (dxa, dya, dxb, dyb, dxc, dyc) {
		var xa = x + dxa;
		var ya = y + dya;
		var xb = xa + dxb;
		var yb = ya + dyb;
		var xc = xb + dxc;
		var yc = yb + dyc;

		function getBezierCritical(x0, x1, x2, x3) {
			var ad = x3 - x0 + 3.0 * (x1 - x2);
			var bd = 2.0 * (x0 + x2) - 4.0 * x1;
			var cd = x1 - x0;
			var dd = bd * bd - 4.0 * ad * cd;
			var x = [x0, x3];

			function addCritical(t) {
				var k = 1.0 - t;
				x.push(x0 * k * k * k
				       + 3.0 * k * t * (x1 * k + x2 * t)
				       + x3 * t * t * t);
			}

			if (dd >= 0) {
				var sd = Math.sqrt(dd);
				var den = ad + ad;
				var t = (-bd + sd) / den;
				if (t > 0 && t < 1)
					addCritical(t);
				var t = (-bd - sd) / den;
				if (t > 0 && t < 1)
					addCritical(t);
			}

			return x;
		}

		var xs = getBezierCritical(x, xa, xb, xc);
		xm = Math.min.apply(null, xs);
		xM = Math.max.apply(null, xs);
		var ys = getBezierCritical(y, ya, yb, yc);
		ym = Math.min.apply(null, ys);
		yM = Math.max.apply(null, ys);

		updateBBox(xm, xM, ym, yM);
		
		x = xc;
		y = yc;
	}

	function getSubrBias(nSubrs) {
		return nSubrs < 1240 ? 107 : (nSubrs < 33900 ? 1131 : 32768);
	}

	var stack = [];
	var trans = [];
	var hints = 0;

	var gBias = getSubrBias(font.cff.globalSubrs.length);
	var localSubrs;
	var lBias;
	if (font.cff.topDict.FDSelect) {
		// TBD
	} else if (font.cff.topDict.privateDict.localSubrs) {
		localSubrs = font.cff.topDict.privateDict.localSubrs;
		lBias = getSubrBias(localSubrs.length);
	}

	function exec (data) {
		for (var i = 0; i < data.length; i++) {
			var b = data[i];
			if (b == 21) {
				// |- dx1 dy1 rmoveto (21) |-
				if (stack.length & 1)
					stack.shift();
				x += stack.shift();
				y += stack.shift();
				stack = [];
			} else if (b == 22) {
				// |- dx1 hmoveto (22) |-
				if (!(stack.length & 1))
					stack.shift();
				x += stack.shift();
				stack = [];
			} else if (b == 4) {
				// |- dy1 vmoveto (4) |-
				if (!(stack.length & 1))
					stack.shift();
				y += stack.shift();
				stack = [];
			} else if (b == 5) {
				// |- {dxa dya}+ rlineto (5) |-
				while (stack.length) {
					var dx = stack.shift();
					var dy = stack.shift();
					lineTo(dx, dy);
				}
			} else if (b == 6) {
				// |- dx1 {dya dxb}* hlineto (6) |-
				// |- {dxa dyb}+ hlineto (6) |-
				while (stack.length) {
					var dx = stack.shift();
					lineTo(dx, 0);
					if (!stack.length)
						break;
					var dy = stack.shift();
					lineTo(0, dy);
				}
			} else if (b == 7) {
				// |- dy1 {dxa dyb}* vlineto (7) |-
				// |- {dya dxb}+ vlineto (7) |-
				while (stack.length) {
					var dy = stack.shift();
					lineTo(0, dy);
					if (!stack.length)
						break;
					var dx = stack.shift();
					lineTo(dx, 0);
				}
			} else if (b == 8) {
				// |- {dxa dya dxb dyb dxc dyc}+
				//    rrcurveto (8) |-
				while (stack.length) {
					var dxa = stack.shift();
					var dya = stack.shift();
					var dxb = stack.shift();
					var dyb = stack.shift();
					var dxc = stack.shift();
					var dyc = stack.shift();
					curveTo(dxa, dya, dxb, dyb, dxc, dyc);
				}
			} else if (b == 27) {
				// |- dy1? {dxa dxb dyb dxc}+ hhcurveto (27) |-
				var dya = 0;
				if (stack.length & 1)
					dya = stack.shift();
				while (stack.length) {
					var dxa = stack.shift();
					var dxb = stack.shift();
					var dyb = stack.shift();
					var dxc = stack.shift();
					curveTo(dxa, dya, dxb, dyb, dxc, 0);
					dya = 0;
				}
			} else if (b == 31) {
				// |- dx1 dx2 dy2 dy3
				//    {dya dxb dyb dxc dxd dxe dye dyf}*
				//    dxf? hvcurveto (31) |-
				// |- {dxa dxb dyb dyc dyd dxe dye dxf}+ dyf?
				//    hvcurveto (31) |-
				if (stack.length & 4) {
					var dxa = stack.shift();
					var dxb = stack.shift();
					var dyb = stack.shift();
					var dyc = stack.shift();
					var dxc = 0;
					if (stack.length == 1)
						dxc = stack.shift();
					curveTo(dxa, 0, dxb, dyb, dxc, dyc);
					while (stack.length) {
						var dya = stack.shift();
						var dxb = stack.shift();
						var dyb = stack.shift();
						var dxc = stack.shift();
						var dxd = stack.shift();
						var dxe = stack.shift();
						var dye = stack.shift();
						var dyf = stack.shift();
						var dxf = 0;
						if (stack.length == 1)
							dxf = stack.shift();
						curveTo(0, dya, dxb, dyb,
							dxc, 0);
						curveTo(dxd, 0, dxe, dye,
							dxf, dyf);
					}
				} else {
					while (stack.length) {
						var dxa = stack.shift();
						var dxb = stack.shift();
						var dyb = stack.shift();
						var dyc = stack.shift();
						var dyd = stack.shift();
						var dxe = stack.shift();
						var dye = stack.shift();
						var dxf = stack.shift();
						var dyf = 0;
						if (stack.length == 1)
							dyf = stack.shift();
						curveTo(dxa, 0, dxb, dyb,
							0, dyc);
						curveTo(0, dyd, dxe, dye,
							dxf, dyf);
					}
				}
			} else if (b == 24) {
				// |- {dxa dya dxb dyb dxc dyc}+ dxd dyd
				//    rcurveline (24) |-
				while (stack.length > 2) {
					var dxa = stack.shift();
					var dya = stack.shift();
					var dxb = stack.shift();
					var dyb = stack.shift();
					var dxc = stack.shift();
					var dyc = stack.shift();
					curveTo(dxa, dya, dxb, dyb, dxc, dyc);
				}
				var dxd = stack.shift();
				var dyd = stack.shift();
				lineTo(dxd, dyd);
			} else if (b == 25) {
				// |- {dxa dya}+ dxb dyb dxc dyc dxd dyd
				//    rlinecurve (25) |-
				while (stack.length > 6) {
					var dxa = stack.shift();
					var dya = stack.shift();
					lineTo(dxa, dya);
				}
				var dxb = stack.shift();
				var dyb = stack.shift();
				var dxc = stack.shift();
				var dyc = stack.shift();
				var dxd = stack.shift();
				var dyd = stack.shift();
				curveTo(dxb, dyb, dxc, dyc, dxd, dyd);
			} else if (b == 30) {
				// |- dy1 dx2 dy2 dx3
				//    {dxa dxb dyb dyc dyd dxe dye dxf}*
				//    dyf? vhcurveto (30) |-
				// |- {dya dxb dyb dxc dxd dxe dye dyf}+ dxf?
				//    vhcurveto (30) |-
				if (stack.length & 4) {
					var dya = stack.shift();
					var dxb = stack.shift();
					var dyb = stack.shift();
					var dxc = stack.shift();
					var dyc = 0;
					if (stack.length == 1)
						dyc = stack.shift();
					curveTo(0, dya, dxb, dyb, dxc, dyc);
					while (stack.length) {
						var dxa = stack.shift();
						var dxb = stack.shift();
						var dyb = stack.shift();
						var dyc = stack.shift();
						var dyd = stack.shift();
						var dxe = stack.shift();
						var dye = stack.shift();
						var dxf = stack.shift();
						var dyf = 0;
						if (stack.length == 1)
							dyf = stack.shift();
						curveTo(dxa, 0, dxb, dyb,
							0, dyc);
						curveTo(0, dyd, dxe, dye,
							dxf, dyf);
					}
				} else {
					while (stack.length) {
						var dya = stack.shift();
						var dxb = stack.shift();
						var dyb = stack.shift();
						var dxc = stack.shift();
						var dxd = stack.shift();
						var dxe = stack.shift();
						var dye = stack.shift();
						var dyf = stack.shift();
						var dxf = 0;
						if (stack.length == 1)
							dxf = stack.shift();
						curveTo(0, dya, dxb, dyb,
							dxc, 0);
						curveTo(dxd, 0, dxe, dye,
							dxf, dyf);
					}
				}
			} else if (b == 26) {
				// |- dx1? {dya dxb dyb dyc}+ vvcurveto (26) |-
				var dxa = 0;
				if (stack.length & 1)
					dxa = stack.shift();
				while (stack.length) {
					var dya = stack.shift();
					var dxb = stack.shift();
					var dyb = stack.shift();
					var dyc = stack.shift();
					curveTo(dxa, dya, dxb, dyb, 0, dyc);
					dxa = 0;
				}
			} else if (b == 12) {
				b = data[++i];
				if (b == 35) {
					// |- dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4
					//    dx5 dy5 dx6 dy6 fd flex (12 35) |-
					var dx1 = stack.shift();
					var dy1 = stack.shift();
					var dx2 = stack.shift();
					var dx2 = stack.shift();
					var dx3 = stack.shift();
					var dy3 = stack.shift();
					var dx4 = stack.shift();
					var dy4 = stack.shift();
					var dx5 = stack.shift();
					var dy5 = stack.shift();
					var dx6 = stack.shift();
					var dy6 = stack.shift();
					stack.shift();
					curveTo(dx1, dy1, dx2, dy2, dx3, dy3);
					curveTo(dx4, dy4, dx5, dy5, dx6, dy6);
					stack = [];
				} else if (b == 34) {
					// |- dx1 dx2 dy2 dx3 dx4 dx5 dx6
					//    hflex (12 34) |-
					var dx1 = stack.shift();
					var dy1 = stack.shift();
					var dx2 = stack.shift();
					var dx2 = stack.shift();
					var dx3 = stack.shift();
					var dy3 = stack.shift();
					var dx4 = stack.shift();
					var dy4 = stack.shift();
					var dx5 = stack.shift();
					var dy5 = stack.shift();
					var dx6 = stack.shift();
					var dy6 = stack.shift();
					curveTo(dx1, dy1, dx2, dy2, dx3, dy3);
					curveTo(dx4, dy4, dx5, dy5, dx6, dy6);
					stack = [];
				} else if (b == 36) {
					// |- dx1 dx2 dy2 dx3 dx4 dx5 dx6
					//    hflex1 (12 36) |-
					var dx1 = stack.shift();
					var dy1 = stack.shift();
					var dx2 = stack.shift();
					var dx2 = stack.shift();
					var dx3 = stack.shift();
					var dy3 = stack.shift();
					var dx4 = stack.shift();
					var dy4 = stack.shift();
					var dx5 = stack.shift();
					var dy5 = stack.shift();
					var dx6 = stack.shift();
					var dy6 = stack.shift();
					curveTo(dx1, dy1, dx2, dy2, dx3, dy3);
					curveTo(dx4, dy4, dx5, dy5, dx6, dy6);
					stack = [];
				} else if (b == 37) {
					// |- dx1 dx2 dy2 dx3 dx4 dx5 dx6
					//    flex1 (12 37) |-
					var dx1 = stack.shift();
					var dy1 = stack.shift();
					var dx2 = stack.shift();
					var dx2 = stack.shift();
					var dx3 = stack.shift();
					var dy3 = stack.shift();
					var dx4 = stack.shift();
					var dy4 = stack.shift();
					var dx5 = stack.shift();
					var dy5 = stack.shift();
					var dx6 = stack.shift();
					var dy6 = stack.shift();
					curveTo(dx1, dy1, dx2, dy2, dx3, dy3);
					curveTo(dx4, dy4, dx5, dy5, dx6, dy6);
					stack = [];
				} else if (b == 9) {
					// num abs (12 9) num2
					stack.push(Math.abs(stack.pop()));
				} else if (b == 10) {
					// num1 num2 add (12 10) sum
					stack.push(stack.pop() + stack.pop());
				} else if (b == 11) {
					// num1 num2 sub (12 11) difference
					var v = stack.pop();
					stack.push(stack.pop() - v);
				} else if (b == 12) {
					// num1 num2 div (12 12) quotient
					var v = stack.pop();
					stack.push(stack.pop() / v);
				} else if (b == 14) {
					// num neg (12 14) num2
					stack.push(-stack.pop());
				} else if (b == 23) {
					// random (12 23) num2
					var v = Math.random();
					stack.push(v == 0.0 ? 1.0 : v);
				} else if (b == 24) {
					// num1 num2 mul (12 24) product
					stack.push(stack.pop() * stack.pop());
				} else if (b == 26) {
					// num sqrt (12 26) num2
					stack.push(Math.sqrt(stack.pop));
				} else if (b == 18) {
					// num drop (12 18)
					stack.pop();
				} else if (b == 28) {
					// num1 num2 exch (12 28) num2 num1
					var v1 = stack.pop();
					var v2 = stack.pop();
					stack.push(v1);
					stack.push(v2);
				} else if (b == 29) {
					// numX ... num0 i index (12 29)
					// numX ... num0 numi
					var idx = stack.pop();
					stack.push(stack[stack.length
							 - idx - 1]);
				} else if (b == 30) {
					// num(N–1) ... num0 N J roll (12 30)
					// num((J–1) mod N) ...
					// num0 num(N–1) ... num(J mod N)
					var J = stack.pop();
					var N = stack.pop();
					var c = J % N - N + 1;
					if (c != 0)
						stack.push.apply(stack,
							stack.splice(
								stack.length
								- N, c));
				} else if (b == 27) {
					// any dup (12 27) any any
					stack.push(stack[stack.length - 1]);
				} else if (b == 20) {
					// val i put (12 20)
					var idx = stack.pop();
					trans[idx] = stack.pop();
				} else if (b == 21) {
					// i get (12 21) val
					stack.push(trans[stack.pop()]);
				} else if (b == 3) {
					// num1 num2 and (12 3) 1_or_0
					var v1 = stack.pop();
					var v2 = stack.pop();
					stack.push(v1 != 0 && v2 != 0 ? 1 : 0);
				} else if (b == 4) {
					// num1 num2 or (12 4) 1_or_0
					var v1 = stack.pop();
					var v2 = stack.pop();
					stack.push(v1 != 0 || v2 != 0 ? 1 : 0);
				} else if (b == 5) {
					// num1 not (12 5) 1_or_0
					stack.push(stack.pop() == 0 ? 1 : 0);
				} else if (b == 15) {
					// num1 num2 eq (12 15) 1_or_0
					stack.push(stack.pop() == stack.pop()
						   ? 1 : 0);
				} else if (b == 22) {
					// s1 s2 v1 v2 ifelse (12 22) s1_or_s2
					var v2 = stack.pop();
					var v1 = stack.pop();
					var s2 = stack.pop();
					var s1 = stack.pop();
					stack.push(v1 > v2 ? s2 : s1);
				}
			} else if (b == 14) {
				// – endchar (14) |–
				return;
			} else if (b == 1) {
				// |- y dy {dya dyb}* hstem (1) |-
				hints += stack.length >> 1;
				stack = [];
			} else if (b == 3) {
				// |- x dx {dxa dxb}* vstem (3) |-
				hints += stack.length >> 1;
				stack = [];
			} else if (b == 18) {
				// |- y dy {dya dyb}* hstemhm (18) |-
				hints += stack.length >> 1;
				stack = [];
			} else if (b == 23) {
				// |- x dx {dxa dxb}* vstemhm (23) |-
				hints += stack.length >> 1;
				stack = [];
			} else if (b == 19) {
				// |- hintmask (19 + mask) |-
				hints += stack.length >> 1;
				i += Math.ceil(hints / 8);
				stack = [];
			} else if (b == 20) {
				// |- cntrmask (20 + mask) |-
				hints += stack.length >> 1;
				i += Math.ceil(hints / 8);
				stack = [];
			} else if (b == 10) {
				// subr# callsubr (10) –
				exec(localSubrs[stack.pop() + lBias]);
			} else if (b == 29) {
				// globalsubr# callgsubr (29) –
				exec(font.cff.globalSubrs[stack.pop() + gBias]);
			} else if (b == 11) {
				// – return (11) –
				return;
			} else if (b == 28) {
				stack.push(data[i + 1] << 8 | data[i + 2]);
				i += 2;
			} else if (b >= 32 && b <= 246) {
				stack.push(b - 139);
			} else if (b >= 247 && b <= 250) {
				i++;
				stack.push((b - 247) * 256 + data[i] + 108);
			} else if (b >= 251 && b <= 254) {
				i++;
				stack.push(-(b - 251) * 256 - data[i] - 108);
			} else if (b == 255) {
				var int = data[i + 1] << 8 | data[i + 2];
				if (int & 0x8000)
					int -= 0x10000;
				var frac = data[i + 3] << 8 | data[i + 4];
				stack.push(int + frac / 0x10000);
				i += 4;
			}
		}
	}

	exec(font.cff.topDict.charStrings[glyph.glyphId]);
}

module.exports = function (SFNTMetrics, font, metrics) {
	if (!font.cff)
		return;

	for (var i = 0; i < metrics.glyphs.length; i++)
		getMetrics(font, metrics.glyphs[i]);
};
