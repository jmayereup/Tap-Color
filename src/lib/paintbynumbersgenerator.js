//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/settings.ts
let ClusteringColorSpace = /* @__PURE__ */ function(ClusteringColorSpace) {
	ClusteringColorSpace[ClusteringColorSpace["RGB"] = 0] = "RGB";
	ClusteringColorSpace[ClusteringColorSpace["HSL"] = 1] = "HSL";
	ClusteringColorSpace[ClusteringColorSpace["LAB"] = 2] = "LAB";
	return ClusteringColorSpace;
}({});
var Settings = class {
	constructor() {
		this.kMeansNrOfClusters = 16;
		this.kMeansMinDeltaDifference = 1;
		this.kMeansClusteringColorSpace = 0;
		this.kMeansColorRestrictions = [];
		this.colorAliases = {};
		this.narrowPixelStripCleanupRuns = 3;
		this.removeFacetsSmallerThanNrOfPoints = 20;
		this.removeFacetsFromLargeToSmall = true;
		this.maximumNumberOfFacets = Number.MAX_VALUE;
		this.nrOfTimesToHalveBorderSegments = 2;
		this.resizeImageIfTooLarge = true;
		this.resizeImageWidth = 1024;
		this.resizeImageHeight = 1024;
		this.randomSeed = (/* @__PURE__ */ new Date()).getTime();
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/common.ts
async function delay(ms) {
	if (typeof window !== "undefined") return new Promise((resolve) => window.setTimeout(resolve, ms));
	else return Promise.resolve();
}
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/lib/clustering.ts
var Vector = class Vector {
	constructor(values, weight = 1) {
		this.values = values;
		this.weight = weight;
	}
	distanceTo(p) {
		let sumSquares = 0;
		for (let i = 0; i < this.values.length; i++) sumSquares += (p.values[i] - this.values[i]) * (p.values[i] - this.values[i]);
		return Math.sqrt(sumSquares);
	}
	/**
	*  Calculates the weighted average of the given points
	*/
	static average(pts) {
		if (pts.length === 0) throw Error("Can't average 0 elements");
		const dims = pts[0].values.length;
		const values = [];
		for (let i = 0; i < dims; i++) values.push(0);
		let weightSum = 0;
		for (const p of pts) {
			weightSum += p.weight;
			for (let i = 0; i < dims; i++) values[i] += p.weight * p.values[i];
		}
		for (let i = 0; i < values.length; i++) values[i] /= weightSum;
		return new Vector(values);
	}
};
var KMeans = class {
	constructor(points, k, random, centroids = null) {
		this.points = points;
		this.k = k;
		this.random = random;
		this.currentIteration = 0;
		this.pointsPerCategory = [];
		this.centroids = [];
		this.currentDeltaDistanceDifference = 0;
		if (centroids != null) {
			this.centroids = centroids;
			for (let i = 0; i < this.k; i++) this.pointsPerCategory.push([]);
		} else this.initCentroids();
	}
	initCentroids() {
		for (let i = 0; i < this.k; i++) {
			this.centroids.push(this.points[Math.floor(this.points.length * this.random.next())]);
			this.pointsPerCategory.push([]);
		}
	}
	step() {
		for (let i = 0; i < this.k; i++) this.pointsPerCategory[i] = [];
		for (const p of this.points) {
			let minDist = Number.MAX_VALUE;
			let centroidIndex = -1;
			for (let k = 0; k < this.k; k++) {
				const dist = this.centroids[k].distanceTo(p);
				if (dist < minDist) {
					centroidIndex = k;
					minDist = dist;
				}
			}
			this.pointsPerCategory[centroidIndex].push(p);
		}
		let totalDistanceDiff = 0;
		for (let k = 0; k < this.pointsPerCategory.length; k++) {
			const cat = this.pointsPerCategory[k];
			if (cat.length > 0) {
				const avg = Vector.average(cat);
				const dist = this.centroids[k].distanceTo(avg);
				totalDistanceDiff += dist;
				this.centroids[k] = avg;
			}
		}
		this.currentDeltaDistanceDifference = totalDistanceDiff;
		this.currentIteration++;
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/lib/colorconversion.ts
/**
* Converts an RGB color value to HSL. Conversion formula
* adapted from http://en.wikipedia.org/wiki/HSL_color_space.
* Assumes r, g, and b are contained in the set [0, 255] and
* returns h, s, and l in the set [0, 1].
*
* @param   Number  r       The red color value
* @param   Number  g       The green color value
* @param   Number  b       The blue color value
* @return  Array           The HSL representation
*/
function rgbToHsl(r, g, b) {
	r /= 255, g /= 255, b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h, s, l = (max + min) / 2;
	if (max === min) h = s = 0;
	else {
		const d = max - min;
		s = l > .5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
			default: h = 0;
		}
		h /= 6;
	}
	return [
		h,
		s,
		l
	];
}
/**
* Converts an HSL color value to RGB. Conversion formula
* adapted from http://en.wikipedia.org/wiki/HSL_color_space.
* Assumes h, s, and l are contained in the set [0, 1] and
* returns r, g, and b in the set [0, 255].
*
* @param   Number  h       The hue
* @param   Number  s       The saturation
* @param   Number  l       The lightness
* @return  Array           The RGB representation
*/
function hslToRgb(h, s, l) {
	let r, g, b;
	if (s === 0) r = g = b = l;
	else {
		const hue2rgb = (p, q, t) => {
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			if (t < 1 / 6) return p + (q - p) * 6 * t;
			if (t < 1 / 2) return q;
			if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
			return p;
		};
		const q = l < .5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		r = hue2rgb(p, q, h + 1 / 3);
		g = hue2rgb(p, q, h);
		b = hue2rgb(p, q, h - 1 / 3);
	}
	return [
		r * 255,
		g * 255,
		b * 255
	];
}
function lab2rgb(lab) {
	let y = (lab[0] + 16) / 116, x = lab[1] / 500 + y, z = y - lab[2] / 200, r, g, b;
	x = .95047 * (x * x * x > .008856 ? x * x * x : (x - 16 / 116) / 7.787);
	y = 1 * (y * y * y > .008856 ? y * y * y : (y - 16 / 116) / 7.787);
	z = 1.08883 * (z * z * z > .008856 ? z * z * z : (z - 16 / 116) / 7.787);
	r = x * 3.2406 + y * -1.5372 + z * -.4986;
	g = x * -.9689 + y * 1.8758 + z * .0415;
	b = x * .0557 + y * -.204 + z * 1.057;
	r = r > .0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - .055 : 12.92 * r;
	g = g > .0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - .055 : 12.92 * g;
	b = b > .0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - .055 : 12.92 * b;
	return [
		Math.max(0, Math.min(1, r)) * 255,
		Math.max(0, Math.min(1, g)) * 255,
		Math.max(0, Math.min(1, b)) * 255
	];
}
function rgb2lab(rgb) {
	let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
	r = r > .04045 ? Math.pow((r + .055) / 1.055, 2.4) : r / 12.92;
	g = g > .04045 ? Math.pow((g + .055) / 1.055, 2.4) : g / 12.92;
	b = b > .04045 ? Math.pow((b + .055) / 1.055, 2.4) : b / 12.92;
	x = (r * .4124 + g * .3576 + b * .1805) / .95047;
	y = (r * .2126 + g * .7152 + b * .0722) / 1;
	z = (r * .0193 + g * .1192 + b * .9505) / 1.08883;
	x = x > .008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
	y = y > .008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
	z = z > .008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;
	return [
		116 * y - 16,
		500 * (x - y),
		200 * (y - z)
	];
}
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/structs/typedarrays.ts
var Uint32Array2D = class {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.arr = new Uint32Array(width * height);
	}
	get(x, y) {
		return this.arr[y * this.width + x];
	}
	set(x, y, value) {
		this.arr[y * this.width + x] = value;
	}
};
var Uint8Array2D = class {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.arr = new Uint8Array(width * height);
	}
	get(x, y) {
		return this.arr[y * this.width + x];
	}
	set(x, y, value) {
		this.arr[y * this.width + x] = value;
	}
	matchAllAround(x, y, value) {
		const idx = y * this.width + x;
		return x - 1 >= 0 && this.arr[idx - 1] === value && y - 1 >= 0 && this.arr[idx - this.width] === value && x + 1 < this.width && this.arr[idx + 1] === value && y + 1 < this.height && this.arr[idx + this.width] === value;
	}
};
var BooleanArray2D = class {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.arr = new Uint8Array(width * height);
	}
	get(x, y) {
		return this.arr[y * this.width + x] !== 0;
	}
	set(x, y, value) {
		this.arr[y * this.width + x] = value ? 1 : 0;
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/random.ts
var Random = class {
	constructor(seed) {
		if (typeof seed === "undefined") this.seed = (/* @__PURE__ */ new Date()).getTime();
		else this.seed = seed;
	}
	next() {
		const x = Math.sin(this.seed++) * 1e4;
		return x - Math.floor(x);
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/colorreductionmanagement.ts
/**
* Color reduction management of the process: clustering to reduce colors & creating color map
*/
var ColorMapResult = class {};
var ColorReducer = class ColorReducer {
	/**
	*  Creates a map of the various colors used
	*/
	static createColorMap(kmeansImgData) {
		const imgColorIndices = new Uint8Array2D(kmeansImgData.width, kmeansImgData.height);
		let colorIndex = 0;
		const colors = {};
		const colorsByIndex = [];
		let idx = 0;
		for (let j = 0; j < kmeansImgData.height; j++) for (let i = 0; i < kmeansImgData.width; i++) {
			const r = kmeansImgData.data[idx++];
			const g = kmeansImgData.data[idx++];
			const b = kmeansImgData.data[idx++];
			kmeansImgData.data[idx++];
			let currentColorIndex;
			const color = r + "," + g + "," + b;
			if (typeof colors[color] === "undefined") {
				currentColorIndex = colorIndex;
				colors[color] = colorIndex;
				colorsByIndex.push([
					r,
					g,
					b
				]);
				colorIndex++;
			} else currentColorIndex = colors[color];
			imgColorIndices.set(i, j, currentColorIndex);
		}
		const result = new ColorMapResult();
		result.imgColorIndices = imgColorIndices;
		result.colorsByIndex = colorsByIndex;
		result.width = kmeansImgData.width;
		result.height = kmeansImgData.height;
		return result;
	}
	/**
	*  Applies K-means clustering on the imgData to reduce the colors to
	*  k clusters and then output the result to the given outputImgData
	*/
	static async applyKMeansClustering(imgData, outputImgData, ctx, settings, onUpdate = null, snapMeta = null) {
		const vectors = [];
		let idx = 0;
		let vIdx = 0;
		const bitsToChopOff = 2;
		const pointsByColor = {};
		for (let j = 0; j < imgData.height; j++) for (let i = 0; i < imgData.width; i++) {
			let r = imgData.data[idx++];
			let g = imgData.data[idx++];
			let b = imgData.data[idx++];
			imgData.data[idx++];
			r = r >> bitsToChopOff << bitsToChopOff;
			g = g >> bitsToChopOff << bitsToChopOff;
			b = b >> bitsToChopOff << bitsToChopOff;
			const color = `${r},${g},${b}`;
			if (!(color in pointsByColor)) pointsByColor[color] = [j * imgData.width + i];
			else pointsByColor[color].push(j * imgData.width + i);
		}
		for (const color of Object.keys(pointsByColor)) {
			const rgb = color.split(",").map((v) => parseInt(v));
			let data;
			if (settings.kMeansClusteringColorSpace === 0) data = rgb;
			else if (settings.kMeansClusteringColorSpace === 1) data = rgbToHsl(rgb[0], rgb[1], rgb[2]);
			else if (settings.kMeansClusteringColorSpace === 2) data = rgb2lab(rgb);
			else data = rgb;
			const weight = pointsByColor[color].length / (imgData.width * imgData.height);
			const vec = new Vector(data, weight);
			vec.tag = rgb;
			vectors[vIdx++] = vec;
		}
		const random = new Random(settings.randomSeed === 0 ? (/* @__PURE__ */ new Date()).getTime() : settings.randomSeed);
		const kmeans = new KMeans(vectors, settings.kMeansNrOfClusters, random);
		let curTime = (/* @__PURE__ */ new Date()).getTime();
		kmeans.step();
		while (kmeans.currentDeltaDistanceDifference > settings.kMeansMinDeltaDifference) {
			kmeans.step();
			if ((/* @__PURE__ */ new Date()).getTime() - curTime > 500) {
				curTime = (/* @__PURE__ */ new Date()).getTime();
				await delay(0);
				if (onUpdate != null) {
					ColorReducer.updateKmeansOutputImageData(kmeans, settings, pointsByColor, imgData, outputImgData, false);
					onUpdate(kmeans);
				}
			}
		}
		ColorReducer.updateKmeansOutputImageData(kmeans, settings, pointsByColor, imgData, outputImgData, true, snapMeta);
		if (onUpdate != null) onUpdate(kmeans);
	}
	/**
	*  Updates the image data from the current kmeans centroids and their respective associated colors (vectors)
	*/
	static updateKmeansOutputImageData(kmeans, settings, pointsByColor, imgData, outputImgData, restrictToSpecifiedColors, snapMeta = null) {
		for (let c = 0; c < kmeans.centroids.length; c++) {
			const centroid = kmeans.centroids[c];
			for (const v of kmeans.pointsPerCategory[c]) {
				let rgb;
				if (settings.kMeansClusteringColorSpace === 0) rgb = centroid.values;
				else if (settings.kMeansClusteringColorSpace === 1) {
					const hsl = centroid.values;
					rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
				} else if (settings.kMeansClusteringColorSpace === 2) {
					const lab = centroid.values;
					rgb = lab2rgb(lab);
				} else rgb = centroid.values;
				rgb = rgb.map((v) => Math.floor(v));
				if (restrictToSpecifiedColors) {
					if (settings.kMeansColorRestrictions.length > 0) {
						let minDistance = Number.MAX_VALUE;
						let closestRestrictedColor = null;
						for (const color of settings.kMeansColorRestrictions) {
							const centroidLab = rgb2lab(rgb);
							let restrictionLab;
							if (typeof color === "string") restrictionLab = rgb2lab(settings.colorAliases[color]);
							else restrictionLab = rgb2lab(color);
							const distance = Math.sqrt((centroidLab[0] - restrictionLab[0]) * (centroidLab[0] - restrictionLab[0]) + (centroidLab[1] - restrictionLab[1]) * (centroidLab[1] - restrictionLab[1]) + (centroidLab[2] - restrictionLab[2]) * (centroidLab[2] - restrictionLab[2]));
							if (distance < minDistance) {
								minDistance = distance;
								closestRestrictedColor = color;
							}
						}
						if (closestRestrictedColor !== null) {
							if (typeof closestRestrictedColor === "string") rgb = settings.colorAliases[closestRestrictedColor];
							else rgb = closestRestrictedColor;
							if (snapMeta !== null) {
								const key = `${rgb[0]},${rgb[1]},${rgb[2]}`;
								const sku = typeof closestRestrictedColor === "string" ? closestRestrictedColor : null;
								const prev = snapMeta.get(key);
								if (prev === void 0 || minDistance > prev.distance) snapMeta.set(key, {
									sku,
									distance: minDistance
								});
							}
						}
					}
				}
				let pointRGB = v.tag;
				const pointColor = `${Math.floor(pointRGB[0])},${Math.floor(pointRGB[1])},${Math.floor(pointRGB[2])}`;
				for (const pt of pointsByColor[pointColor]) {
					const ptx = pt % imgData.width;
					let dataOffset = (Math.floor(pt / imgData.width) * imgData.width + ptx) * 4;
					outputImgData.data[dataOffset++] = rgb[0];
					outputImgData.data[dataOffset++] = rgb[1];
					outputImgData.data[dataOffset++] = rgb[2];
				}
			}
		}
	}
	/**
	*  Builds a distance matrix for each color to each other
	*/
	static buildColorDistanceMatrix(colorsByIndex) {
		const colorDistances = new Array(colorsByIndex.length);
		for (let j = 0; j < colorsByIndex.length; j++) colorDistances[j] = new Array(colorDistances.length);
		for (let j = 0; j < colorsByIndex.length; j++) for (let i = j; i < colorsByIndex.length; i++) {
			const c1 = colorsByIndex[j];
			const c2 = colorsByIndex[i];
			const distance = Math.sqrt((c1[0] - c2[0]) * (c1[0] - c2[0]) + (c1[1] - c2[1]) * (c1[1] - c2[1]) + (c1[2] - c2[2]) * (c1[2] - c2[2]));
			colorDistances[i][j] = distance;
			colorDistances[j][i] = distance;
		}
		return colorDistances;
	}
	static async processNarrowPixelStripCleanup(colormapResult) {
		const colorDistances = ColorReducer.buildColorDistanceMatrix(colormapResult.colorsByIndex);
		let count = 0;
		const imgColorIndices = colormapResult.imgColorIndices;
		for (let j = 1; j < colormapResult.height - 1; j++) for (let i = 1; i < colormapResult.width - 1; i++) {
			const top = imgColorIndices.get(i, j - 1);
			const bottom = imgColorIndices.get(i, j + 1);
			const left = imgColorIndices.get(i - 1, j);
			const right = imgColorIndices.get(i + 1, j);
			const cur = imgColorIndices.get(i, j);
			if (cur !== top && cur !== bottom && cur !== left && cur !== right) {} else if (cur !== top && cur !== bottom) {
				const topColorDistance = colorDistances[cur][top];
				const bottomColorDistance = colorDistances[cur][bottom];
				imgColorIndices.set(i, j, topColorDistance < bottomColorDistance ? top : bottom);
				count++;
			} else if (cur !== left && cur !== right) {
				const leftColorDistance = colorDistances[cur][left];
				const rightColorDistance = colorDistances[cur][right];
				imgColorIndices.set(i, j, leftColorDistance < rightColorDistance ? left : right);
				count++;
			}
		}
		console.log(count + " pixels replaced to remove narrow pixel strips");
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/lib/fill.ts
function fill(x, y, width, height, visited, setFill) {
	let xx = x;
	let yy = y;
	while (true) {
		const ox = xx;
		const oy = yy;
		while (yy !== 0 && !visited(xx, yy - 1)) yy--;
		while (xx !== 0 && !visited(xx - 1, yy)) xx--;
		if (xx === ox && yy === oy) break;
	}
	fillCore(xx, yy, width, height, visited, setFill);
}
function fillCore(x, y, width, height, visited, setFill) {
	let lastRowLength = 0;
	do {
		let rowLength = 0;
		let sx = x;
		if (lastRowLength !== 0 && visited(x, y)) {
			do
				if (--lastRowLength === 0) return;
			while (visited(++x, y));
			sx = x;
		} else for (; x !== 0 && !visited(x - 1, y); rowLength++, lastRowLength++) {
			x--;
			setFill(x, y);
			if (y !== 0 && !visited(x, y - 1)) fill(x, y - 1, width, height, visited, setFill);
		}
		for (; sx < width && !visited(sx, y); rowLength++, sx++) setFill(sx, y);
		if (rowLength < lastRowLength) {
			for (const end = x + lastRowLength; ++sx < end;) if (!visited(sx, y)) fillCore(sx, y, width, height, visited, setFill);
		} else if (rowLength > lastRowLength && y !== 0) {
			for (let ux = x + lastRowLength; ++ux < sx;) if (!visited(ux, y - 1)) fill(ux, y - 1, width, height, visited, setFill);
		}
		lastRowLength = rowLength;
	} while (lastRowLength !== 0 && ++y < height);
}
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/structs/boundingbox.ts
var BoundingBox = class {
	constructor() {
		this.minX = Number.MAX_VALUE;
		this.minY = Number.MAX_VALUE;
		this.maxX = Number.MIN_VALUE;
		this.maxY = Number.MIN_VALUE;
	}
	get width() {
		return this.maxX - this.minX + 1;
	}
	get height() {
		return this.maxY - this.minY + 1;
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/structs/point.ts
var Point = class {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
	distanceTo(pt) {
		return Math.abs(pt.x - this.x) + Math.abs(pt.y - this.y);
	}
	distanceToCoord(x, y) {
		return Math.abs(x - this.x) + Math.abs(y - this.y);
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/facetmanagement.ts
let OrientationEnum = /* @__PURE__ */ function(OrientationEnum) {
	OrientationEnum[OrientationEnum["Left"] = 0] = "Left";
	OrientationEnum[OrientationEnum["Top"] = 1] = "Top";
	OrientationEnum[OrientationEnum["Right"] = 2] = "Right";
	OrientationEnum[OrientationEnum["Bottom"] = 3] = "Bottom";
	return OrientationEnum;
}({});
/**
* PathPoint is a point with an orientation that indicates which wall border is set
*/
var PathPoint = class extends Point {
	constructor(pt, orientation) {
		super(pt.x, pt.y);
		this.orientation = orientation;
	}
	getWallX() {
		let x = this.x;
		if (this.orientation === 0) x -= .5;
		else if (this.orientation === 2) x += .5;
		return x;
	}
	getWallY() {
		let y = this.y;
		if (this.orientation === 1) y -= .5;
		else if (this.orientation === 3) y += .5;
		return y;
	}
	getNeighbour(facetResult) {
		switch (this.orientation) {
			case 0:
				if (this.x - 1 >= 0) return facetResult.facetMap.get(this.x - 1, this.y);
				break;
			case 2:
				if (this.x + 1 < facetResult.width) return facetResult.facetMap.get(this.x + 1, this.y);
				break;
			case 1:
				if (this.y - 1 >= 0) return facetResult.facetMap.get(this.x, this.y - 1);
				break;
			case 3: if (this.y + 1 < facetResult.height) return facetResult.facetMap.get(this.x, this.y + 1);
		}
		return -1;
	}
	toString() {
		return this.x + "," + this.y + " " + this.orientation;
	}
};
/**
*  A facet that represents an area of pixels of the same color
*/
var Facet = class {
	constructor() {
		this.pointCount = 0;
		this.neighbourFacetsIsDirty = false;
	}
	getFullPathFromBorderSegments(useWalls) {
		const newpath = [];
		const addPoint = (pt) => {
			if (useWalls) newpath.push(new Point(pt.getWallX(), pt.getWallY()));
			else newpath.push(new Point(pt.x, pt.y));
		};
		let lastSegment = null;
		for (const seg of this.borderSegments) {
			if (lastSegment != null) {
				if (lastSegment.reverseOrder) addPoint(lastSegment.originalSegment.points[0]);
				else addPoint(lastSegment.originalSegment.points[lastSegment.originalSegment.points.length - 1]);
			}
			for (let i = 0; i < seg.originalSegment.points.length; i++) {
				const idx = seg.reverseOrder ? seg.originalSegment.points.length - 1 - i : i;
				addPoint(seg.originalSegment.points[idx]);
			}
			lastSegment = seg;
		}
		return newpath;
	}
};
/**
*  Result of the facet construction, both as a map and as an array.
*  Facets in the array can be null when they've been deleted
*/
var FacetResult = class {};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/facetCreator.ts
var FacetCreator = class FacetCreator {
	/**
	*  Constructs the facets with its border points for each area of pixels of the same color
	*/
	static async getFacets(width, height, imgColorIndices, onUpdate = null) {
		const result = new FacetResult();
		result.width = width;
		result.height = height;
		const visited = new BooleanArray2D(result.width, result.height);
		result.facetMap = new Uint32Array2D(result.width, result.height);
		result.facets = [];
		let count = 0;
		for (let j = 0; j < result.height; j++) for (let i = 0; i < result.width; i++) {
			const colorIndex = imgColorIndices.get(i, j);
			if (!visited.get(i, j)) {
				const facetIndex = result.facets.length;
				const facet = FacetCreator.buildFacet(facetIndex, colorIndex, i, j, visited, imgColorIndices, result);
				result.facets.push(facet);
				if (count % 100 === 0) {
					await delay(0);
					if (onUpdate != null) onUpdate(count / (result.width * result.height));
				}
			}
			count++;
		}
		await delay(0);
		for (const f of result.facets) if (f != null) FacetCreator.buildFacetNeighbour(f, result);
		if (onUpdate != null) onUpdate(1);
		return result;
	}
	/**
	*  Builds a facet at given x,y using depth first search to visit all pixels of the same color
	*/
	static buildFacet(facetIndex, facetColorIndex, x, y, visited, imgColorIndices, facetResult) {
		const facet = new Facet();
		facet.id = facetIndex;
		facet.color = facetColorIndex;
		facet.bbox = new BoundingBox();
		facet.borderPoints = [];
		facet.neighbourFacetsIsDirty = true;
		facet.neighbourFacets = null;
		fill(x, y, facetResult.width, facetResult.height, (ptx, pty) => visited.get(ptx, pty) || imgColorIndices.get(ptx, pty) !== facetColorIndex, (ptx, pty) => {
			visited.set(ptx, pty, true);
			facetResult.facetMap.set(ptx, pty, facetIndex);
			facet.pointCount++;
			if (!imgColorIndices.matchAllAround(ptx, pty, facetColorIndex)) facet.borderPoints.push(new Point(ptx, pty));
			if (ptx > facet.bbox.maxX) facet.bbox.maxX = ptx;
			if (pty > facet.bbox.maxY) facet.bbox.maxY = pty;
			if (ptx < facet.bbox.minX) facet.bbox.minX = ptx;
			if (pty < facet.bbox.minY) facet.bbox.minY = pty;
		});
		return facet;
	}
	/**
	* Check which neighbour facets the given facet has by checking the neighbour facets at each border point
	*/
	static buildFacetNeighbour(facet, facetResult) {
		facet.neighbourFacets = [];
		const uniqueFacets = {};
		for (const pt of facet.borderPoints) {
			if (pt.x - 1 >= 0) {
				const leftFacetId = facetResult.facetMap.get(pt.x - 1, pt.y);
				if (leftFacetId !== facet.id) uniqueFacets[leftFacetId] = true;
			}
			if (pt.y - 1 >= 0) {
				const topFacetId = facetResult.facetMap.get(pt.x, pt.y - 1);
				if (topFacetId !== facet.id) uniqueFacets[topFacetId] = true;
			}
			if (pt.x + 1 < facetResult.width) {
				const rightFacetId = facetResult.facetMap.get(pt.x + 1, pt.y);
				if (rightFacetId !== facet.id) uniqueFacets[rightFacetId] = true;
			}
			if (pt.y + 1 < facetResult.height) {
				const bottomFacetId = facetResult.facetMap.get(pt.x, pt.y + 1);
				if (bottomFacetId !== facet.id) uniqueFacets[bottomFacetId] = true;
			}
		}
		for (const k of Object.keys(uniqueFacets)) if (uniqueFacets.hasOwnProperty(k)) facet.neighbourFacets.push(parseInt(k));
		facet.neighbourFacetsIsDirty = false;
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/facetReducer.ts
var FacetReducer = class FacetReducer {
	/**
	*  Remove all facets that have a pointCount smaller than the given number.
	*/
	static async reduceFacets(smallerThan, removeFacetsFromLargeToSmall, maximumNumberOfFacets, colorsByIndex, facetResult, imgColorIndices, onUpdate = null) {
		const visitedCache = new BooleanArray2D(facetResult.width, facetResult.height);
		const colorDistances = ColorReducer.buildColorDistanceMatrix(colorsByIndex);
		const facetProcessingOrder = facetResult.facets.filter((f) => f != null).slice(0).sort((a, b) => b.pointCount > a.pointCount ? 1 : b.pointCount < a.pointCount ? -1 : 0).map((f) => f.id);
		if (!removeFacetsFromLargeToSmall) facetProcessingOrder.reverse();
		let curTime = (/* @__PURE__ */ new Date()).getTime();
		for (let fidx = 0; fidx < facetProcessingOrder.length; fidx++) {
			const f = facetResult.facets[facetProcessingOrder[fidx]];
			if (f != null && f.pointCount < smallerThan) {
				FacetReducer.deleteFacet(f.id, facetResult, imgColorIndices, colorDistances, visitedCache);
				if ((/* @__PURE__ */ new Date()).getTime() - curTime > 500) {
					curTime = (/* @__PURE__ */ new Date()).getTime();
					await delay(0);
					if (onUpdate != null) onUpdate(.5 * fidx / facetProcessingOrder.length);
				}
			}
		}
		let facetCount = facetResult.facets.filter((f) => f != null).length;
		if (facetCount > maximumNumberOfFacets) console.log(`There are still ${facetCount} facets, more than the maximum of ${maximumNumberOfFacets}. Removing the smallest facets`);
		const startFacetCount = facetCount;
		while (facetCount > maximumNumberOfFacets) {
			const facetProcessingOrder = facetResult.facets.filter((f) => f != null).slice(0).sort((a, b) => b.pointCount > a.pointCount ? 1 : b.pointCount < a.pointCount ? -1 : 0).map((f) => f.id).reverse();
			const facetToRemove = facetResult.facets[facetProcessingOrder[0]];
			FacetReducer.deleteFacet(facetToRemove.id, facetResult, imgColorIndices, colorDistances, visitedCache);
			facetCount = facetResult.facets.filter((f) => f != null).length;
			if ((/* @__PURE__ */ new Date()).getTime() - curTime > 500) {
				curTime = (/* @__PURE__ */ new Date()).getTime();
				await delay(0);
				if (onUpdate != null) onUpdate(1 - (facetCount - maximumNumberOfFacets) / (startFacetCount - maximumNumberOfFacets));
			}
		}
		if (onUpdate != null) onUpdate(1);
	}
	/**
	* Deletes a facet. All points belonging to the facet are moved to the nearest neighbour facet
	* based on the distance of the neighbour border points. This results in a voronoi like filling in of the
	* void the deletion made
	*/
	static deleteFacet(facetIdToRemove, facetResult, imgColorIndices, colorDistances, visitedArrayCache) {
		const facetToRemove = facetResult.facets[facetIdToRemove];
		if (facetToRemove === null) return;
		if (facetToRemove.neighbourFacetsIsDirty) FacetCreator.buildFacetNeighbour(facetToRemove, facetResult);
		if (facetToRemove.neighbourFacets.length > 0) {
			for (let j = facetToRemove.bbox.minY; j <= facetToRemove.bbox.maxY; j++) for (let i = facetToRemove.bbox.minX; i <= facetToRemove.bbox.maxX; i++) if (facetResult.facetMap.get(i, j) === facetToRemove.id) {
				const closestNeighbour = FacetReducer.getClosestNeighbourForPixel(facetToRemove, facetResult, i, j, colorDistances);
				if (closestNeighbour !== -1) imgColorIndices.set(i, j, facetResult.facets[closestNeighbour].color);
				else console.warn(`No closest neighbour found for point ${i},${j}`);
			}
		} else console.warn(`Facet ${facetToRemove.id} does not have any neighbours`);
		FacetReducer.rebuildForFacetChange(visitedArrayCache, facetToRemove, imgColorIndices, facetResult);
		facetResult.facets[facetToRemove.id] = null;
	}
	static rebuildForFacetChange(visitedArrayCache, facet, imgColorIndices, facetResult) {
		FacetReducer.rebuildChangedNeighbourFacets(visitedArrayCache, facet, imgColorIndices, facetResult);
		let needsToRebuild = false;
		for (let y = facet.bbox.minY; y <= facet.bbox.maxY; y++) for (let x = facet.bbox.minX; x <= facet.bbox.maxX; x++) if (facetResult.facetMap.get(x, y) === facet.id) {
			console.warn(`Point ${x},${y} was reallocated to neighbours for facet ${facet.id}`);
			needsToRebuild = true;
			if (x - 1 >= 0 && facetResult.facetMap.get(x - 1, y) !== facet.id && facetResult.facets[facetResult.facetMap.get(x - 1, y)] !== null) imgColorIndices.set(x, y, facetResult.facets[facetResult.facetMap.get(x - 1, y)].color);
			else if (y - 1 >= 0 && facetResult.facetMap.get(x, y - 1) !== facet.id && facetResult.facets[facetResult.facetMap.get(x, y - 1)] !== null) imgColorIndices.set(x, y, facetResult.facets[facetResult.facetMap.get(x, y - 1)].color);
			else if (x + 1 < facetResult.width && facetResult.facetMap.get(x + 1, y) !== facet.id && facetResult.facets[facetResult.facetMap.get(x + 1, y)] !== null) imgColorIndices.set(x, y, facetResult.facets[facetResult.facetMap.get(x + 1, y)].color);
			else if (y + 1 < facetResult.height && facetResult.facetMap.get(x, y + 1) !== facet.id && facetResult.facets[facetResult.facetMap.get(x, y + 1)] !== null) imgColorIndices.set(x, y, facetResult.facets[facetResult.facetMap.get(x, y + 1)].color);
			else console.error(`Unable to reallocate point ${x},${y}`);
		}
		if (needsToRebuild) FacetReducer.rebuildChangedNeighbourFacets(visitedArrayCache, facet, imgColorIndices, facetResult);
	}
	/**
	* Determines the closest neighbour for a given pixel of a facet, based on the closest distance to the neighbour AND the when tied, the closest color
	*/
	static getClosestNeighbourForPixel(facetToRemove, facetResult, x, y, colorDistances) {
		let closestNeighbour = -1;
		let minDistance = Number.MAX_VALUE;
		let minColorDistance = Number.MAX_VALUE;
		if (facetToRemove.neighbourFacetsIsDirty) FacetCreator.buildFacetNeighbour(facetToRemove, facetResult);
		for (const neighbourIdx of facetToRemove.neighbourFacets) {
			const neighbour = facetResult.facets[neighbourIdx];
			if (neighbour != null) for (const bpt of neighbour.borderPoints) {
				const distance = bpt.distanceToCoord(x, y);
				if (distance < minDistance) {
					minDistance = distance;
					closestNeighbour = neighbourIdx;
					minColorDistance = Number.MAX_VALUE;
				} else if (distance === minDistance) {
					const colorDistance = colorDistances[facetToRemove.color][neighbour.color];
					if (colorDistance < minColorDistance) {
						minColorDistance = colorDistance;
						closestNeighbour = neighbourIdx;
					}
				}
			}
		}
		return closestNeighbour;
	}
	/**
	*  Rebuilds the given changed facets
	*/
	static rebuildChangedNeighbourFacets(visitedArrayCache, facetToRemove, imgColorIndices, facetResult) {
		const changedNeighboursSet = {};
		if (facetToRemove.neighbourFacetsIsDirty) FacetCreator.buildFacetNeighbour(facetToRemove, facetResult);
		for (const neighbourIdx of facetToRemove.neighbourFacets) {
			const neighbour = facetResult.facets[neighbourIdx];
			if (neighbour != null) {
				changedNeighboursSet[neighbourIdx] = true;
				if (neighbour.neighbourFacetsIsDirty) FacetCreator.buildFacetNeighbour(neighbour, facetResult);
				for (const n of neighbour.neighbourFacets) changedNeighboursSet[n] = true;
				const newFacet = FacetCreator.buildFacet(neighbourIdx, neighbour.color, neighbour.borderPoints[0].x, neighbour.borderPoints[0].y, visitedArrayCache, imgColorIndices, facetResult);
				facetResult.facets[neighbourIdx] = newFacet;
				if (newFacet.pointCount === 0) facetResult.facets[neighbourIdx] = null;
			}
		}
		if (facetToRemove.neighbourFacetsIsDirty) FacetCreator.buildFacetNeighbour(facetToRemove, facetResult);
		for (const neighbourIdx of facetToRemove.neighbourFacets) {
			const neighbour = facetResult.facets[neighbourIdx];
			if (neighbour != null) {
				for (let y = neighbour.bbox.minY; y <= neighbour.bbox.maxY; y++) for (let x = neighbour.bbox.minX; x <= neighbour.bbox.maxX; x++) if (facetResult.facetMap.get(x, y) === neighbour.id) visitedArrayCache.set(x, y, false);
			}
		}
		for (const k of Object.keys(changedNeighboursSet)) if (changedNeighboursSet.hasOwnProperty(k)) {
			const neighbourIdx = parseInt(k);
			const f = facetResult.facets[neighbourIdx];
			if (f != null) {
				f.neighbourFacets = null;
				f.neighbourFacetsIsDirty = true;
			}
		}
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/facetBorderTracer.ts
var FacetBorderTracer = class FacetBorderTracer {
	/**
	*  Traces the border path of the facet from the facet border points.
	*  Imagine placing walls around the outer side of the border points.
	*/
	static async buildFacetBorderPaths(facetResult, onUpdate = null) {
		let count = 0;
		const borderMask = new BooleanArray2D(facetResult.width, facetResult.height);
		const facetProcessingOrder = facetResult.facets.filter((f) => f != null).slice(0).sort((a, b) => b.pointCount > a.pointCount ? 1 : b.pointCount < a.pointCount ? -1 : 0).map((f) => f.id);
		for (let fidx = 0; fidx < facetProcessingOrder.length; fidx++) {
			const f = facetResult.facets[facetProcessingOrder[fidx]];
			if (f != null) {
				for (const bp of f.borderPoints) borderMask.set(bp.x, bp.y, true);
				const xWall = new BooleanArray2D(facetResult.width + 1, facetResult.height + 1);
				const yWall = new BooleanArray2D(facetResult.width + 1, facetResult.height + 1);
				let borderStartIndex = -1;
				for (let i = 0; i < f.borderPoints.length; i++) if (f.borderPoints[i].x === f.bbox.minX || f.borderPoints[i].x === f.bbox.maxX || f.borderPoints[i].y === f.bbox.minY || f.borderPoints[i].y === f.bbox.maxY) {
					borderStartIndex = i;
					break;
				}
				const pt = new PathPoint(f.borderPoints[borderStartIndex], 0);
				if (pt.x - 1 < 0 || facetResult.facetMap.get(pt.x - 1, pt.y) !== f.id) pt.orientation = 0;
				else if (pt.y - 1 < 0 || facetResult.facetMap.get(pt.x, pt.y - 1) !== f.id) pt.orientation = 1;
				else if (pt.x + 1 >= facetResult.width || facetResult.facetMap.get(pt.x + 1, pt.y) !== f.id) pt.orientation = 2;
				else if (pt.y + 1 >= facetResult.height || facetResult.facetMap.get(pt.x, pt.y + 1) !== f.id) pt.orientation = 3;
				f.borderPath = FacetBorderTracer.getPath(pt, facetResult, f, borderMask, xWall, yWall);
				if (count % 100 === 0) {
					await delay(0);
					if (onUpdate != null) onUpdate(fidx / facetProcessingOrder.length);
				}
			}
			count++;
		}
		if (onUpdate != null) onUpdate(1);
	}
	/**
	* Returns a border path starting from the given point
	*/
	static getPath(pt, facetResult, f, borderMask, xWall, yWall) {
		let finished = false;
		const path = [];
		FacetBorderTracer.addPointToPath(path, pt, xWall, f, yWall);
		while (!finished) {
			const possibleNextPoints = [];
			if (pt.orientation === 0) {
				if ((pt.y - 1 >= 0 && facetResult.facetMap.get(pt.x, pt.y - 1) !== f.id || pt.y - 1 < 0) && !yWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 1);
					possibleNextPoints.push(nextpt);
				}
				if ((pt.y + 1 < facetResult.height && facetResult.facetMap.get(pt.x, pt.y + 1) !== f.id || pt.y + 1 >= facetResult.height) && !yWall.get(pt.x, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 3);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y - 1 >= 0 && facetResult.facetMap.get(pt.x, pt.y - 1) === f.id && (pt.x - 1 < 0 || facetResult.facetMap.get(pt.x - 1, pt.y - 1) !== f.id) && borderMask.get(pt.x, pt.y - 1) && !xWall.get(pt.x, pt.y - 1)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y - 1), 0);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y + 1 < facetResult.height && facetResult.facetMap.get(pt.x, pt.y + 1) === f.id && (pt.x - 1 < 0 || facetResult.facetMap.get(pt.x - 1, pt.y + 1) !== f.id) && borderMask.get(pt.x, pt.y + 1) && !xWall.get(pt.x, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y + 1), 0);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y - 1 >= 0 && pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y - 1) === f.id && borderMask.get(pt.x - 1, pt.y - 1) && !yWall.get(pt.x - 1, pt.y - 1 + 1) && !yWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x - 1, pt.y - 1), 3);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y + 1 < facetResult.height && pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y + 1) === f.id && borderMask.get(pt.x - 1, pt.y + 1) && !yWall.get(pt.x - 1, pt.y + 1) && !yWall.get(pt.x, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x - 1, pt.y + 1), 1);
					possibleNextPoints.push(nextpt);
				}
			} else if (pt.orientation === 1) {
				if ((pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y) !== f.id || pt.x - 1 < 0) && !xWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 0);
					possibleNextPoints.push(nextpt);
				}
				if ((pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y) !== f.id || pt.x + 1 >= facetResult.width) && !xWall.get(pt.x + 1, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 2);
					possibleNextPoints.push(nextpt);
				}
				if (pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y) === f.id && (pt.y - 1 < 0 || facetResult.facetMap.get(pt.x - 1, pt.y - 1) !== f.id) && borderMask.get(pt.x - 1, pt.y) && !yWall.get(pt.x - 1, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x - 1, pt.y), 1);
					possibleNextPoints.push(nextpt);
				}
				if (pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y) === f.id && (pt.y - 1 < 0 || facetResult.facetMap.get(pt.x + 1, pt.y - 1) !== f.id) && borderMask.get(pt.x + 1, pt.y) && !yWall.get(pt.x + 1, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x + 1, pt.y), 1);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y - 1 >= 0 && pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y - 1) === f.id && borderMask.get(pt.x - 1, pt.y - 1) && !xWall.get(pt.x - 1 + 1, pt.y - 1) && !xWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x - 1, pt.y - 1), 2);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y - 1 >= 0 && pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y - 1) === f.id && borderMask.get(pt.x + 1, pt.y - 1) && !xWall.get(pt.x + 1, pt.y - 1) && !xWall.get(pt.x + 1, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x + 1, pt.y - 1), 0);
					possibleNextPoints.push(nextpt);
				}
			} else if (pt.orientation === 2) {
				if ((pt.y - 1 >= 0 && facetResult.facetMap.get(pt.x, pt.y - 1) !== f.id || pt.y - 1 < 0) && !yWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 1);
					possibleNextPoints.push(nextpt);
				}
				if ((pt.y + 1 < facetResult.height && facetResult.facetMap.get(pt.x, pt.y + 1) !== f.id || pt.y + 1 >= facetResult.height) && !yWall.get(pt.x, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 3);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y - 1 >= 0 && facetResult.facetMap.get(pt.x, pt.y - 1) === f.id && (pt.x + 1 >= facetResult.width || facetResult.facetMap.get(pt.x + 1, pt.y - 1) !== f.id) && borderMask.get(pt.x, pt.y - 1) && !xWall.get(pt.x + 1, pt.y - 1)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y - 1), 2);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y + 1 < facetResult.height && facetResult.facetMap.get(pt.x, pt.y + 1) === f.id && (pt.x + 1 >= facetResult.width || facetResult.facetMap.get(pt.x + 1, pt.y + 1) !== f.id) && borderMask.get(pt.x, pt.y + 1) && !xWall.get(pt.x + 1, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y + 1), 2);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y - 1 >= 0 && pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y - 1) === f.id && borderMask.get(pt.x + 1, pt.y - 1) && !yWall.get(pt.x + 1, pt.y - 1 + 1) && !yWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x + 1, pt.y - 1), 3);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y + 1 < facetResult.height && pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y + 1) === f.id && borderMask.get(pt.x + 1, pt.y + 1) && !yWall.get(pt.x + 1, pt.y + 1) && !yWall.get(pt.x, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x + 1, pt.y + 1), 1);
					possibleNextPoints.push(nextpt);
				}
			} else if (pt.orientation === 3) {
				if ((pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y) !== f.id || pt.x - 1 < 0) && !xWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 0);
					possibleNextPoints.push(nextpt);
				}
				if ((pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y) !== f.id || pt.x + 1 >= facetResult.width) && !xWall.get(pt.x + 1, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x, pt.y), 2);
					possibleNextPoints.push(nextpt);
				}
				if (pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y) === f.id && (pt.y + 1 >= facetResult.height || facetResult.facetMap.get(pt.x - 1, pt.y + 1) !== f.id) && borderMask.get(pt.x - 1, pt.y) && !yWall.get(pt.x - 1, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x - 1, pt.y), 3);
					possibleNextPoints.push(nextpt);
				}
				if (pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y) === f.id && (pt.y + 1 >= facetResult.height || facetResult.facetMap.get(pt.x + 1, pt.y + 1) !== f.id) && borderMask.get(pt.x + 1, pt.y) && !yWall.get(pt.x + 1, pt.y + 1)) {
					const nextpt = new PathPoint(new Point(pt.x + 1, pt.y), 3);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y + 1 < facetResult.height && pt.x - 1 >= 0 && facetResult.facetMap.get(pt.x - 1, pt.y + 1) === f.id && borderMask.get(pt.x - 1, pt.y + 1) && !xWall.get(pt.x - 1 + 1, pt.y + 1) && !xWall.get(pt.x, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x - 1, pt.y + 1), 2);
					possibleNextPoints.push(nextpt);
				}
				if (pt.y + 1 < facetResult.height && pt.x + 1 < facetResult.width && facetResult.facetMap.get(pt.x + 1, pt.y + 1) === f.id && borderMask.get(pt.x + 1, pt.y + 1) && !xWall.get(pt.x + 1, pt.y + 1) && !xWall.get(pt.x + 1, pt.y)) {
					const nextpt = new PathPoint(new Point(pt.x + 1, pt.y + 1), 0);
					possibleNextPoints.push(nextpt);
				}
			}
			if (possibleNextPoints.length > 1) {
				pt = possibleNextPoints[0];
				FacetBorderTracer.addPointToPath(path, pt, xWall, f, yWall);
			} else if (possibleNextPoints.length === 1) {
				pt = possibleNextPoints[0];
				FacetBorderTracer.addPointToPath(path, pt, xWall, f, yWall);
			} else finished = true;
		}
		for (const pathPoint of path) switch (pathPoint.orientation) {
			case 0:
				xWall.set(pathPoint.x, pathPoint.y, false);
				break;
			case 1:
				yWall.set(pathPoint.x, pathPoint.y, false);
				break;
			case 2:
				xWall.set(pathPoint.x + 1, pathPoint.y, false);
				break;
			case 3: yWall.set(pathPoint.x, pathPoint.y + 1, false);
		}
		return path;
	}
	/**
	* Add a point to the border path and ensure the correct xWall/yWalls is set
	*/
	static addPointToPath(path, pt, xWall, f, yWall) {
		path.push(pt);
		switch (pt.orientation) {
			case 0:
				xWall.set(pt.x, pt.y, true);
				break;
			case 1:
				yWall.set(pt.x, pt.y, true);
				break;
			case 2:
				xWall.set(pt.x + 1, pt.y, true);
				break;
			case 3: yWall.set(pt.x, pt.y + 1, true);
		}
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/facetBorderSegmenter.ts
/**
*  Path segment is a segment of a border path that is adjacent to a specific neighbour facet
*/
var PathSegment = class {
	constructor(points, neighbour) {
		this.points = points;
		this.neighbour = neighbour;
	}
};
/**
* Facet boundary segment describes the matched segment that is shared between 2 facets
* When 2 segments are matched, one will be the original segment and the other one is removed
* This ensures that all facets share the same segments, but sometimes in reverse order to ensure
* the correct continuity of its entire oborder path
*/
var FacetBoundarySegment = class {
	constructor(originalSegment, neighbour, reverseOrder) {
		this.originalSegment = originalSegment;
		this.neighbour = neighbour;
		this.reverseOrder = reverseOrder;
	}
};
var FacetBorderSegmenter = class FacetBorderSegmenter {
	/**
	*  Builds border segments that are shared between facets
	*  While border paths are all nice and fancy, they are not linked to neighbour facets
	*  So any change in the paths makes a not so nice gap between the facets, which makes smoothing them out impossible
	*/
	static async buildFacetBorderSegments(facetResult, nrOfTimesToHalvePoints = 2, onUpdate = null) {
		const segmentsPerFacet = FacetBorderSegmenter.prepareSegmentsPerFacet(facetResult);
		FacetBorderSegmenter.reduceSegmentComplexity(facetResult, segmentsPerFacet, nrOfTimesToHalvePoints);
		await FacetBorderSegmenter.matchSegmentsWithNeighbours(facetResult, segmentsPerFacet, onUpdate);
	}
	/**
	*  Chops up the border paths per facet into segments adjacent tothe same neighbour
	*/
	static prepareSegmentsPerFacet(facetResult) {
		const segmentsPerFacet = new Array(facetResult.facets.length);
		for (const f of facetResult.facets) if (f != null) {
			const segments = [];
			if (f.borderPath.length > 1) {
				let currentPoints = [];
				currentPoints.push(f.borderPath[0]);
				for (let i = 1; i < f.borderPath.length; i++) {
					const prevBorderPoint = f.borderPath[i - 1];
					const curBorderPoint = f.borderPath[i];
					const oldNeighbour = prevBorderPoint.getNeighbour(facetResult);
					const curNeighbour = curBorderPoint.getNeighbour(facetResult);
					let isTransitionPoint = false;
					if (oldNeighbour !== curNeighbour) isTransitionPoint = true;
					else if (oldNeighbour !== -1) {
						if (prevBorderPoint.x === curBorderPoint.x && prevBorderPoint.y === curBorderPoint.y) {
							if (prevBorderPoint.orientation === 1 && curBorderPoint.orientation === 0 || prevBorderPoint.orientation === 0 && curBorderPoint.orientation === 1) {
								if (facetResult.facetMap.get(curBorderPoint.x - 1, curBorderPoint.y - 1) !== oldNeighbour) isTransitionPoint = true;
							} else if (prevBorderPoint.orientation === 1 && curBorderPoint.orientation === 2 || prevBorderPoint.orientation === 2 && curBorderPoint.orientation === 1) {
								if (facetResult.facetMap.get(curBorderPoint.x + 1, curBorderPoint.y - 1) !== oldNeighbour) isTransitionPoint = true;
							} else if (prevBorderPoint.orientation === 3 && curBorderPoint.orientation === 0 || prevBorderPoint.orientation === 0 && curBorderPoint.orientation === 3) {
								if (facetResult.facetMap.get(curBorderPoint.x - 1, curBorderPoint.y + 1) !== oldNeighbour) isTransitionPoint = true;
							} else if (prevBorderPoint.orientation === 3 && curBorderPoint.orientation === 2 || prevBorderPoint.orientation === 2 && curBorderPoint.orientation === 3) {
								if (facetResult.facetMap.get(curBorderPoint.x + 1, curBorderPoint.y + 1) !== oldNeighbour) isTransitionPoint = true;
							}
						}
					}
					currentPoints.push(curBorderPoint);
					if (isTransitionPoint) {
						if (currentPoints.length > 1) {
							const segment = new PathSegment(currentPoints, oldNeighbour);
							segments.push(segment);
							currentPoints = [curBorderPoint];
						}
					}
				}
				if (currentPoints.length > 1) {
					const oldNeighbour = f.borderPath[f.borderPath.length - 1].getNeighbour(facetResult);
					if (segments.length > 0 && segments[0].neighbour === oldNeighbour) {
						const mergedPoints = currentPoints.concat(segments[0].points);
						segments[0].points = mergedPoints;
					} else {
						const segment = new PathSegment(currentPoints, oldNeighbour);
						segments.push(segment);
						currentPoints = [];
					}
				}
			}
			segmentsPerFacet[f.id] = segments;
		}
		return segmentsPerFacet;
	}
	/**
	* Reduces each segment border path points
	*/
	static reduceSegmentComplexity(facetResult, segmentsPerFacet, nrOfTimesToHalvePoints) {
		for (const f of facetResult.facets) if (f != null) for (const segment of segmentsPerFacet[f.id]) for (let i = 0; i < nrOfTimesToHalvePoints; i++) segment.points = FacetBorderSegmenter.reduceSegmentHaarWavelet(segment.points, true, facetResult.width, facetResult.height);
	}
	/**
	*  Remove the points by taking the average per pair and using that as a new point
	*  in the reduced segment. The delta values that create the Haar wavelet are not tracked
	*  because they are unneeded.
	*/
	static reduceSegmentHaarWavelet(newpath, skipOutsideBorders, width, height) {
		if (newpath.length <= 5) return newpath;
		const reducedPath = [];
		reducedPath.push(newpath[0]);
		for (let i = 1; i < newpath.length - 2; i += 2) if (!skipOutsideBorders || skipOutsideBorders && !FacetBorderSegmenter.isOutsideBorderPoint(newpath[i], width, height)) {
			const cx = (newpath[i].x + newpath[i + 1].x) / 2;
			const cy = (newpath[i].y + newpath[i + 1].y) / 2;
			reducedPath.push(new PathPoint(new Point(cx, cy), 0));
		} else {
			reducedPath.push(newpath[i]);
			reducedPath.push(newpath[i + 1]);
		}
		reducedPath.push(newpath[newpath.length - 1]);
		return reducedPath;
	}
	static isOutsideBorderPoint(point, width, height) {
		return point.x === 0 || point.y === 0 || point.x === width - 1 || point.y === height - 1;
	}
	static calculateArea(path) {
		let total = 0;
		for (let i = 0; i < path.length; i++) {
			const addX = path[i].x;
			const addY = path[i === path.length - 1 ? 0 : i + 1].y;
			const subX = path[i === path.length - 1 ? 0 : i + 1].x;
			const subY = path[i].y;
			total += addX * addY * .5;
			total -= subX * subY * .5;
		}
		return Math.abs(total);
	}
	/**
	*  Matches all segments with each other between facets and their neighbour
	*  A segment matches when the start and end match or the start matches with the end and vice versa
	*  (then the segment will need to be traversed in reverse order)
	*/
	static async matchSegmentsWithNeighbours(facetResult, segmentsPerFacet, onUpdate = null) {
		const MAX_DISTANCE = 4;
		for (const f of facetResult.facets) if (f != null) f.borderSegments = new Array(segmentsPerFacet[f.id].length);
		let count = 0;
		for (const f of facetResult.facets) {
			if (f != null) {
				for (let s = 0; s < segmentsPerFacet[f.id].length; s++) {
					const segment = segmentsPerFacet[f.id][s];
					if (segment != null && f.borderSegments[s] == null) {
						f.borderSegments[s] = new FacetBoundarySegment(segment, segment.neighbour, false);
						if (segment.neighbour !== -1) {
							const neighbourFacet = facetResult.facets[segment.neighbour];
							if (neighbourFacet != null) {
								const neighbourSegments = segmentsPerFacet[segment.neighbour];
								for (let ns = 0; ns < neighbourSegments.length; ns++) {
									const neighbourSegment = neighbourSegments[ns];
									if (neighbourSegment != null && neighbourSegment.neighbour === f.id) {
										const segStartPoint = segment.points[0];
										const segEndPoint = segment.points[segment.points.length - 1];
										const nSegStartPoint = neighbourSegment.points[0];
										const nSegEndPoint = neighbourSegment.points[neighbourSegment.points.length - 1];
										let matchesStraight = segStartPoint.distanceTo(nSegStartPoint) <= MAX_DISTANCE && segEndPoint.distanceTo(nSegEndPoint) <= MAX_DISTANCE;
										let matchesReverse = segStartPoint.distanceTo(nSegEndPoint) <= MAX_DISTANCE && segEndPoint.distanceTo(nSegStartPoint) <= MAX_DISTANCE;
										if (matchesStraight && matchesReverse) {
											if (segStartPoint.distanceTo(nSegStartPoint) + segEndPoint.distanceTo(nSegEndPoint) < segStartPoint.distanceTo(nSegEndPoint) + segEndPoint.distanceTo(nSegStartPoint)) {
												matchesStraight = true;
												matchesReverse = false;
											} else {
												matchesStraight = false;
												matchesReverse = true;
											}
										}
										if (matchesStraight) {
											neighbourFacet.borderSegments[ns] = new FacetBoundarySegment(segment, f.id, false);
											segmentsPerFacet[neighbourFacet.id][ns] = null;
											break;
										} else if (matchesReverse) {
											neighbourFacet.borderSegments[ns] = new FacetBoundarySegment(segment, f.id, true);
											segmentsPerFacet[neighbourFacet.id][ns] = null;
											break;
										}
									}
								}
							}
						}
					}
					segmentsPerFacet[f.id][s] = null;
				}
				if (count % 100 === 0) {
					await delay(0);
					if (onUpdate != null) onUpdate(f.id / facetResult.facets.length);
				}
			}
			count++;
		}
		if (onUpdate != null) onUpdate(1);
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/lib/datastructs.ts
var Map = class Map {
	constructor() {
		this.obj = {};
	}
	containsKey(key) {
		return key in this.obj;
	}
	getKeys() {
		const keys = [];
		for (const el in this.obj) if (this.obj.hasOwnProperty(el)) keys.push(el);
		return keys;
	}
	get(key) {
		const o = this.obj[key];
		if (typeof o === "undefined") return null;
		else return o;
	}
	put(key, value) {
		this.obj[key] = value;
	}
	remove(key) {
		delete this.obj[key];
	}
	clone() {
		const m = new Map();
		m.obj = {};
		for (const p in this.obj) m.obj[p] = this.obj[p];
		return m;
	}
};
var Heap = class Heap {
	constructor() {
		this.array = [];
		this.keyMap = new Map();
	}
	add(obj) {
		if (this.keyMap.containsKey(obj.getKey())) throw new Error("Item with key " + obj.getKey() + " already exists in the heap");
		this.array.push(obj);
		this.keyMap.put(obj.getKey(), this.array.length - 1);
		this.checkParentRequirement(this.array.length - 1);
	}
	replaceAt(idx, newobj) {
		this.array[idx] = newobj;
		this.keyMap.put(newobj.getKey(), idx);
		this.checkParentRequirement(idx);
		this.checkChildrenRequirement(idx);
	}
	shift() {
		return this.removeAt(0);
	}
	remove(obj) {
		const idx = this.keyMap.get(obj.getKey());
		if (idx === -1) return;
		this.removeAt(idx);
	}
	removeWhere(predicate) {
		const itemsToRemove = [];
		for (let i = this.array.length - 1; i >= 0; i--) if (predicate(this.array[i])) itemsToRemove.push(this.array[i]);
		for (const el of itemsToRemove) this.remove(el);
		for (const el of this.array) if (predicate(el)) {
			console.log("Idx of element not removed: " + this.keyMap.get(el.getKey()));
			throw new Error("element not removed: " + el.getKey());
		}
	}
	removeAt(idx) {
		const obj = this.array[idx];
		this.keyMap.remove(obj.getKey());
		const isLastElement = idx === this.array.length - 1;
		if (this.array.length > 0) {
			const newobj = this.array.pop();
			if (!isLastElement && this.array.length > 0) this.replaceAt(idx, newobj);
		}
		return obj;
	}
	foreach(func) {
		const arr = this.array.sort((e, e2) => e.compareTo(e2));
		for (const el of arr) func(el);
	}
	peek() {
		return this.array[0];
	}
	contains(key) {
		return this.keyMap.containsKey(key);
	}
	at(key) {
		const obj = this.keyMap.get(key);
		if (typeof obj === "undefined") return null;
		else return this.array[obj];
	}
	size() {
		return this.array.length;
	}
	checkHeapRequirement(item) {
		const idx = this.keyMap.get(item.getKey());
		if (idx != null) {
			this.checkParentRequirement(idx);
			this.checkChildrenRequirement(idx);
		}
	}
	checkChildrenRequirement(idx) {
		let stop = false;
		while (!stop) {
			const left = this.getLeftChildIndex(idx);
			let right = left === -1 ? -1 : left + 1;
			if (left === -1) return;
			if (right >= this.size()) right = -1;
			let minIdx;
			if (right === -1) minIdx = left;
			else minIdx = this.array[left].compareTo(this.array[right]) < 0 ? left : right;
			if (this.array[idx].compareTo(this.array[minIdx]) > 0) {
				this.swap(idx, minIdx);
				idx = minIdx;
			} else stop = true;
		}
	}
	checkParentRequirement(idx) {
		let curIdx = idx;
		let parentIdx = Heap.getParentIndex(curIdx);
		while (parentIdx >= 0 && this.array[parentIdx].compareTo(this.array[curIdx]) > 0) {
			this.swap(curIdx, parentIdx);
			curIdx = parentIdx;
			parentIdx = Heap.getParentIndex(curIdx);
		}
	}
	dump() {
		if (this.size() === 0) return;
		this.getLeftChildIndex(0) + 1;
		console.log(this.array);
		console.log("--- keymap ---");
		console.log(this.keyMap);
	}
	swap(i, j) {
		this.keyMap.put(this.array[i].getKey(), j);
		this.keyMap.put(this.array[j].getKey(), i);
		const tmp = this.array[i];
		this.array[i] = this.array[j];
		this.array[j] = tmp;
	}
	getLeftChildIndex(curIdx) {
		const idx = (curIdx + 1) * 2 - 1;
		if (idx >= this.array.length) return -1;
		else return idx;
	}
	static getParentIndex(curIdx) {
		if (curIdx === 0) return -1;
		return Math.floor((curIdx + 1) / 2) - 1;
	}
	clone() {
		const h = new Heap();
		h.array = this.array.slice(0);
		h.keyMap = this.keyMap.clone();
		return h;
	}
};
var PriorityQueue = class PriorityQueue {
	constructor() {
		this.heap = new Heap();
	}
	enqueue(obj) {
		this.heap.add(obj);
	}
	peek() {
		return this.heap.peek();
	}
	updatePriority(key) {
		this.heap.checkHeapRequirement(key);
	}
	get(key) {
		return this.heap.at(key);
	}
	get size() {
		return this.heap.size();
	}
	dequeue() {
		return this.heap.shift();
	}
	dump() {
		this.heap.dump();
	}
	contains(key) {
		return this.heap.contains(key);
	}
	removeWhere(predicate) {
		this.heap.removeWhere(predicate);
	}
	foreach(func) {
		this.heap.foreach(func);
	}
	clone() {
		const p = new PriorityQueue();
		p.heap = this.heap.clone();
		return p;
	}
};
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/lib/polylabel.ts
function polylabel(polygon, precision = 1) {
	let minX = Number.MAX_VALUE;
	let minY = Number.MAX_VALUE;
	let maxX = Number.MIN_VALUE;
	let maxY = Number.MIN_VALUE;
	for (let i = 0; i < polygon[0].length; i++) {
		const p = polygon[0][i];
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	const width = maxX - minX;
	const height = maxY - minY;
	const cellSize = Math.min(width, height);
	let h = cellSize / 2;
	const cellQueue = new PriorityQueue();
	if (cellSize === 0) return {
		pt: {
			x: minX,
			y: minY
		},
		distance: 0
	};
	for (let x = minX; x < maxX; x += cellSize) for (let y = minY; y < maxY; y += cellSize) cellQueue.enqueue(new Cell(x + h, y + h, h, polygon));
	let bestCell = getCentroidCell(polygon);
	const bboxCell = new Cell(minX + width / 2, minY + height / 2, 0, polygon);
	if (bboxCell.d > bestCell.d) bestCell = bboxCell;
	let numProbes = cellQueue.size;
	while (cellQueue.size > 0) {
		const cell = cellQueue.dequeue();
		if (cell.d > bestCell.d) bestCell = cell;
		if (cell.max - bestCell.d <= precision) continue;
		h = cell.h / 2;
		cellQueue.enqueue(new Cell(cell.x - h, cell.y - h, h, polygon));
		cellQueue.enqueue(new Cell(cell.x + h, cell.y - h, h, polygon));
		cellQueue.enqueue(new Cell(cell.x - h, cell.y + h, h, polygon));
		cellQueue.enqueue(new Cell(cell.x + h, cell.y + h, h, polygon));
		numProbes += 4;
	}
	return {
		pt: {
			x: bestCell.x,
			y: bestCell.y
		},
		distance: bestCell.d
	};
}
var Cell = class {
	constructor(x, y, h, polygon) {
		this.x = x;
		this.y = y;
		this.h = h;
		this.d = pointToPolygonDist(x, y, polygon);
		this.max = this.d + this.h * Math.SQRT2;
	}
	compareTo(other) {
		return other.max - this.max;
	}
	getKey() {
		return this.x + "," + this.y;
	}
};
function getSegDistSq(px, py, a, b) {
	let x = a.x;
	let y = a.y;
	let dx = b.x - x;
	let dy = b.y - y;
	if (dx !== 0 || dy !== 0) {
		const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
		if (t > 1) {
			x = b.x;
			y = b.y;
		} else if (t > 0) {
			x += dx * t;
			y += dy * t;
		}
	}
	dx = px - x;
	dy = py - y;
	return dx * dx + dy * dy;
}
/**
* Signed distance from point to polygon outline (negative if point is outside)
*/
function pointToPolygonDist(x, y, polygon) {
	let inside = false;
	let minDistSq = Infinity;
	for (let k = 0; k < polygon.length; k++) {
		const ring = polygon[k];
		for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
			const a = ring[i];
			const b = ring[j];
			if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
			minDistSq = Math.min(minDistSq, getSegDistSq(x, y, a, b));
		}
	}
	return (inside ? 1 : -1) * Math.sqrt(minDistSq);
}
function getCentroidCell(polygon) {
	let area = 0;
	let x = 0;
	let y = 0;
	const points = polygon[0];
	for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
		const a = points[i];
		const b = points[j];
		const f = a.x * b.y - b.x * a.y;
		x += (a.x + b.x) * f;
		y += (a.y + b.y) * f;
		area += f * 3;
	}
	if (area === 0) return new Cell(points[0].x, points[0].y, 0, polygon);
	return new Cell(x / area, y / area, 0, polygon);
}
//#endregion
//#region ../../.gemini/antigravity/brain/7c86bfb0-badc-420d-a802-d4ca756b74ec/scratch/pbn-gen/src/facetLabelPlacer.ts
var FacetLabelPlacer = class FacetLabelPlacer {
	/**
	*  Determines where to place the labels for each facet. This is done by calculating where
	*  in the polygon the largest circle can be contained, also called the pole of inaccessibility
	*  That's the spot where there will be the most room for the label.
	*  One tricky gotcha: neighbour facets can lay completely inside other facets and can overlap the label
	*  if only the outer border of the facet is taken in account. This is solved by adding the neighbours facet polygon that fall
	*  within the facet as additional polygon rings (why does everything look so easy to do yet never is under the hood :/)
	*/
	static async buildFacetLabelBounds(facetResult, onUpdate = null) {
		let count = 0;
		for (const f of facetResult.facets) {
			if (f != null) {
				const polyRings = [];
				const borderPath = f.getFullPathFromBorderSegments(true);
				polyRings.push(borderPath);
				const onlyOuterRing = [borderPath];
				if (f.neighbourFacetsIsDirty) FacetCreator.buildFacetNeighbour(f, facetResult);
				for (const neighbourIdx of f.neighbourFacets) {
					const neighbourPath = facetResult.facets[neighbourIdx].getFullPathFromBorderSegments(true);
					if (FacetLabelPlacer.doesNeighbourFallInsideInCurrentFacet(neighbourPath, f, onlyOuterRing)) polyRings.push(neighbourPath);
				}
				const result = polylabel(polyRings);
				f.labelBounds = new BoundingBox();
				const innerPadding = 2 * Math.sqrt(2 * result.distance);
				f.labelBounds.minX = result.pt.x - innerPadding;
				f.labelBounds.maxX = result.pt.x + innerPadding;
				f.labelBounds.minY = result.pt.y - innerPadding;
				f.labelBounds.maxY = result.pt.y + innerPadding;
				if (count % 100 === 0) {
					await delay(0);
					if (onUpdate != null) onUpdate(f.id / facetResult.facets.length);
				}
			}
			count++;
		}
		if (onUpdate != null) onUpdate(1);
	}
	/**
	*  Checks whether a neighbour border path is fully within the current facet border path
	*/
	static doesNeighbourFallInsideInCurrentFacet(neighbourPath, f, onlyOuterRing) {
		let fallsInside = true;
		for (let i = 0; i < neighbourPath.length && fallsInside; i++) if (neighbourPath[i].x >= f.bbox.minX && neighbourPath[i].x <= f.bbox.maxX && neighbourPath[i].y >= f.bbox.minY && neighbourPath[i].y <= f.bbox.maxY) {} else fallsInside = false;
		if (fallsInside) {
			for (let i = 0; i < neighbourPath.length && fallsInside; i++) if (pointToPolygonDist(neighbourPath[i].x, neighbourPath[i].y, onlyOuterRing) < 0) fallsInside = false;
		}
		return fallsInside;
	}
};
//#endregion
export { BooleanArray2D, BoundingBox, ClusteringColorSpace, ColorMapResult, ColorReducer, Facet, FacetBorderSegmenter, FacetBorderTracer, FacetBoundarySegment, FacetCreator, FacetLabelPlacer, FacetReducer, FacetResult, OrientationEnum, PathPoint, PathSegment, Point, Settings, Uint32Array2D, Uint8Array2D, hslToRgb, lab2rgb, pointToPolygonDist, polylabel, rgb2lab, rgbToHsl };
