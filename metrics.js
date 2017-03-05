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

module.exports = {
	getMetrics: function (font, plugins) {
		var metrics = {
			unitsPerEm:		font.head.unitsPerEm,
			ascender:		font["OS/2"].sTypoAscender,
			descender:		font["OS/2"].sTypoDescender,
			lineGap:		font["OS/2"].sTypoLineGap,
			subscriptXSize:		font["OS/2"].ySubscriptXSize,
			subscriptYSize:		font["OS/2"].ySubscriptYSize,
			subscriptXOffset:	font["OS/2"].ySubscriptXOffset,
			subscriptYOffset:	font["OS/2"].ySubscriptYOffset,
			superscriptXSize:	font["OS/2"].ySuperscriptXSize,
			superscriptYSize:	font["OS/2"].ySuperscriptYSize,
			superscriptXOffset:
				font["OS/2"].ySuperscriptXOffset,
			superscriptYOffset:
				font["OS/2"].ySuperscriptYOffset,
			underlinePosition:	font["post"].underlinePosition,
			glyphs:			[]
		};

		var cmap = font.cmap.tables.find(
			function (cmap) {
				return cmap.platformId == 0
				       && cmap.format == 12;
			});
		if (cmap) {
			metrics.glyphs[0] = {
				glyphId:		0,
				advanceWidth:
					font.hmtx[0].advanceWidth,
				leftSideBearing:
					font.hmtx[0].leftSideBearing,
			};
			var k = 1;
			for (var i = 0; i < cmap.groups.length; i++) {
				for (var j = cmap.groups[i].startCharCode;
				     j <= cmap.groups[i].endCharCode; j++) {
					var gid = j
						  - cmap.groups[i].startCharCode
						  + cmap.groups[i].startGlyphId;
					metrics.glyphs[k] = {
						glyphId:		gid,
						charCode:		j,
						advanceWidth:
							font.hmtx[gid]
							    .advanceWidth,
						leftSideBearing:
							font.hmtx[gid]
							    .leftSideBearing
					};
					k++;
				}
			}
		} else {
			cmap = font.cmap.tables.find(
				function (cmap) {
					return cmap.platformId == 0
					       && cmap.format == 4;
				});
			metrics.glyphs[0] = {
				glyphId:		0,
				advanceWidth:
					font.hmtx[0].advanceWidth,
				leftSideBearing:
					font.hmtx[0].leftSideBearing,
			};
			var k = 1;
			for (var i = 0; i < cmap.segments.length; i++) {
				for (var j = cmap.segments[i].startCode;
				     j <= cmap.segments[i].endCode; j++) {
					var gid = (j + cmap.segments[i].idDelta)
						  & 0xffff;
					metrics.glyphs[k] = {
						glyphId:	gid,
						charCode:	j,
						advanceWidth:
							font.hmtx[gid]
							    .advanceWidth,
						leftSideBearing:
							font.hmtx[gid]
							    .leftSideBearing
					};
					k++;
				}
			}
		}

		for (var i = 0; i < plugins.length; i++)
			plugins[i](this, font, metrics);

		return metrics;
	}
};
