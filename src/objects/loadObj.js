/**
 * @author peterqliu / https://github.com/peterqliu
 * @author jscastro / https://github.com/jscastro76
 */
const utils = require("../utils/utils.js");
const Objects = require('./objects.js');
const OBJLoader = require("./loaders/OBJLoader.js");
const MTLLoader = require("./loaders/MTLLoader.js");
const FBXLoader = require("./loaders/FBXLoader.js");
const GLTFLoader = require("./loaders/GLTFLoader.js");
const ColladaLoader = require("./loaders/ColladaLoader.js");
const {IFCLoader} = require("web-ifc-three");
const objLoader = new OBJLoader();
const materialLoader = new MTLLoader();
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const daeLoader = new ColladaLoader();
const ifcLoader = new IFCLoader();

function loadObj(options, cb, promise) {

	if (options === undefined) return console.error("Invalid options provided to loadObj()");
	options = utils._validate(options, Objects.prototype._defaults.loadObj);

	let loader;
	if (!options.type) { options.type = 'mtl'; }
	//[jscastro] support other models
	switch (options.type) {
		case "mtl":
			// TODO: Support formats other than OBJ/MTL
			loader = objLoader;
			break;
		case "gltf":
		case "glb":
			// [jscastro] Support for GLTF/GLB
			loader = gltfLoader;
			break;
		case "fbx":
			loader = fbxLoader;
			break;
		case "dae":
			loader = daeLoader;
			break;
		case "ifc":
			loader = ifcLoader;
			break;
	}

	materialLoader.load(options.mtl, loadObject, () => (null), error => {
		console.warn("No material file found " + error.stack);
	});

	function loadObject(materials) {

		if (materials && options.type === "mtl") {
			materials.preload();
			loader.setMaterials(materials);
		}

		configureLoader(loader, options.type).then(() => {
			loader.load(options.obj, obj => {
					//[jscastro] MTL/GLTF/FBX models have a different structure
					let animations = [];
					switch (options.type) {
						case "mtl":
							obj = obj.children[0];
							break;
						case "gltf":
						case "glb":
						case "dae":
							animations = obj.animations;
							obj = obj.scene;
							break;
						case "fbx":
							animations = obj.animations;
							break;
					}
					obj.animations = animations;
					// [jscastro] options.rotation was wrongly used
					const r = utils.types.rotation(options.rotation, [0, 0, 0]);
					const s = utils.types.scale(options.scale, [1, 1, 1]);
					obj.rotation.set(r[0], r[1], r[2]);
					obj.scale.set(s[0], s[1], s[2]);
					// [jscastro] normalize specular/metalness/shininess from meshes in FBX and GLB model as it would need 5 lights to illuminate them properly
					if (options.normalize) {
						normalizeSpecular(obj);
					}
					obj.name = "model";
					let userScaleGroup = Objects.prototype._makeGroup(obj, options);
					Objects.prototype._addMethods(userScaleGroup);
					//[jscastro] calculate automatically the pivotal center of the object
					userScaleGroup.setAnchor(options.anchor);
					//[jscastro] override the center calculated if the object has adjustments
					userScaleGroup.setCenter(options.adjustment);
					//[jscastro] if the object is excluded from raycasting
					userScaleGroup.raycasted = options.raycasted;
					//[jscastro] return to cache
					promise(userScaleGroup);
					//[jscastro] then return to the client-side callback
					cb(userScaleGroup);
					//[jscastro] apply the fixed zoom scale if needed
					userScaleGroup.setFixedZoom(options.mapScale);
					//[jscastro] initialize the default animation to avoid issues with skeleton position
					userScaleGroup.idle();

				}, () => (null), error => {
					console.error("Could not load model file: " + options.obj + " \n " + error);
					promise("Error loading the model");
				}
			);
		});
	}

	//[jscastro] some FBX/GLTF models have too much specular effects for mapbox
	function normalizeSpecular(model) {
		model.traverse(function (c) {

			if (c.isMesh) {
				//c.castShadow = true;
				let specularColor;
				if (c.material.type == 'MeshStandardMaterial') {

					if (c.material.metalness) { c.material.metalness *= 0.1; }
					if (c.material.glossiness) { c.material.glossiness *= 0.25; }
					specularColor = new THREE.Color(12, 12, 12);

				} else if (c.material.type == 'MeshPhongMaterial') {
					c.material.shininess = 0.1;
					specularColor = new THREE.Color(20, 20, 20);
				}
				if (c.material.specular && c.material.specular.isColor) {
					c.material.specular = specularColor;
				}
				//c.material.needsUpdate = true;

			}

		});
	}

	// @see https://github.com/IFCjs/web-ifc-three/blob/main/example/src/ifc-manager.js
	function configureLoader(loader, type) {
		return new Promise((resolve, reject) => {
			if (type !== 'ifc') {
				resolve();
			} else {
				// const {IFCSPACE, IFCOPENINGELEMENT} = require("three");
				// const {acceleratedRaycast, computeBoundsTree, disposeBoundsTree} = require('three-mesh-bvh');
				// loader.ifcManager.useFragments = false;
				// loader.ifcManager.setupThreeMeshBVH(
				// 	computeBoundsTree,
				// 	disposeBoundsTree,
				// 	acceleratedRaycast
				// );
				// loader.ifcManager.parser.setupOptionalCategories({
				// 	[IFCSPACE]: false,
				// 	[IFCOPENINGELEMENT]: false
				// }).then(() => {
				// 	console.log('configure loader done');
				// 	resolve();
				// })
				loader.ifcManager.applyWebIfcConfig({
					COORDINATE_TO_ORIGIN: true,
					USE_FAST_BOOLS: true
				}).then(() => {
					resolve();
				});
			}
		});
	}
}

module.exports = exports = loadObj;
