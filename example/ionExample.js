import {
	DebugTilesRenderer as TilesRenderer,
	NONE,
	SCREEN_ERROR,
	GEOMETRIC_ERROR,
	DISTANCE,
	DEPTH,
	RELATIVE_DEPTH,
	IS_LEAF,
	RANDOM_COLOR,
	TilesRendererBase,
} from '../src/index.js';
import {
	Scene,
	DirectionalLight,
	AmbientLight,
	WebGLRenderer,
	PerspectiveCamera,
	CameraHelper,
	Raycaster,
	Vector2,
	Mesh,
	CylinderBufferGeometry,
	MeshBasicMaterial,
	Group,
	TorusBufferGeometry,
	OrthographicCamera,
	sRGBEncoding
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as dat from 'three/examples/jsm/libs/dat.gui.module.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

const ALL_HITS = 1;
const FIRST_HIT_ONLY = 2;

const hashUrl = window.location.hash.replace( /^#/, '' );
let camera, controls, scene, renderer, tiles, cameraHelper;
let thirdPersonCamera, thirdPersonRenderer, thirdPersonControls;
let secondRenderer, secondCameraHelper, secondControls, secondCamera;
let orthoCamera, orthoCameraHelper;
let raycaster, mouse, rayIntersect, lastHoveredElement;
let offsetParent;
let statsContainer, stats;

let params = {

	'enableUpdate': true,
	'raycast': NONE,
	'enableCacheDisplay': false,
	'enableRendererStats': false,
	'orthographic': false,

	'ionAssetId': '40866',
	'ionAccessToken': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwY2Q2MzQ1OS1kNjI4LTRiZDEtOWVkZC1kMWI4YzAyODU3OGMiLCJpZCI6MjU5LCJpYXQiOjE2MDY4NzMyMTh9.8EwC6vilVHM2yizt8nG6VmbNu66QiCrk3O-1lEDPI9I',
	'preFetchToken': false,
	'errorTarget': 6,
	'errorThreshold': 60,
	'maxDepth': 15,
	'loadSiblings': true,
	'stopAtEmptyTiles': true,
	'displayActiveTiles': false,
	'resolutionScale': 1.0,

	'up': hashUrl ? '+Z' : '+Y',
	'displayBoxBounds': false,
	'colorMode': 0,
	'showThirdPerson': false,
	'showSecondView': false,
	'reload': reinstantiateTiles,

};

init();
animate();

function loadIonJson( assetId, accessToken ) {

	const ionEndpointUrl = new URL(
		`https://api.cesium.com/v1/assets/${assetId}/endpoint`
	);
	ionEndpointUrl.searchParams.append( "access_token", accessToken );

	return fetch( ionEndpointUrl, { mode: 'cors' } )
		.then( ( res ) => {

			if ( res.ok ) {

				return res.json();

			} else {

				return Promise.reject( `${res.status} : ${res.statusText}` );

			}

		} )
		.then( ( json ) => {

			return [ json.url, json.accessToken ];

		} );

}

function setupTiles() {

	tiles.fetchOptions.mode = 'cors';

	// Note the DRACO compression files need to be supplied via an explicit source.
	// We use unpkg here but in practice should be provided by the application.
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath( 'https://unpkg.com/three@0.123.0/examples/js/libs/draco/gltf/' );
	dracoLoader.setDecoderConfig( { type: "js" } );

	const loader = new GLTFLoader( tiles.manager );
	loader.setDRACOLoader( dracoLoader );

	tiles.manager.addHandler( /\.gltf$/, {

		parse( ...args ) {

			return loader.parse( ...args );

		}

	} );
	offsetParent.add( tiles.group );

}

function reinstantiateTiles() {

	const url = hashUrl || '../data/tileset.json';

	if ( tiles ) {

		offsetParent.remove( tiles.group );
		tiles.dispose();

	}

	if ( params.ionAssetId ) {

		if ( params.preFetchToken ) {

			// If you don't want to share your ion access token on the client you can pre-fetch a temporary 1h bearer token on the server like so
			loadIonJson( params.ionAssetId, params.ionAccessToken )
				.then( ( [ ionUrl, token ] ) => {

					tiles = new TilesRenderer( ionUrl, token );

					setupTiles();

				} );


		} else {

			// If no access token is given, the default ion token will be used.
			tiles = new TilesRenderer( params.ionAssetId, params.ionAccessToken );

			setupTiles();

		}


	} else {

		tiles = new TilesRenderer( url );

		setupTiles();

	}

}

function init() {

	scene = new Scene();

	// primary camera view
	renderer = new WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x151c1f );
	renderer.outputEncoding = sRGBEncoding;

	document.body.appendChild( renderer.domElement );

	camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 4000 );
	camera.position.set( 400, 400, 400 );
	cameraHelper = new CameraHelper( camera );
	scene.add( cameraHelper );

	orthoCamera = new OrthographicCamera();
	orthoCameraHelper = new CameraHelper( orthoCamera );
	scene.add( orthoCameraHelper );

	// secondary camera view
	secondCamera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 4000 );
	secondCamera.position.set( 400, 400, - 400 );
	secondCamera.lookAt( 0, 0, 0 );

	secondRenderer = new WebGLRenderer( { antialias: true } );
	secondRenderer.setPixelRatio( window.devicePixelRatio );
	secondRenderer.setSize( window.innerWidth, window.innerHeight );
	secondRenderer.setClearColor( 0x151c1f );
	secondRenderer.outputEncoding = sRGBEncoding;

	document.body.appendChild( secondRenderer.domElement );
	secondRenderer.domElement.style.position = 'absolute';
	secondRenderer.domElement.style.right = '0';
	secondRenderer.domElement.style.top = '0';
	secondRenderer.domElement.style.outline = '#0f1416 solid 2px';

	secondControls = new OrbitControls( secondCamera, secondRenderer.domElement );
	secondControls.screenSpacePanning = false;
	secondControls.minDistance = 1;
	secondControls.maxDistance = 2000;

	secondCameraHelper = new CameraHelper( secondCamera );
	scene.add( secondCameraHelper );

	// Third person camera view
	thirdPersonCamera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 4000 );
	thirdPersonCamera.position.set( 50, 40, 40 );
	thirdPersonCamera.lookAt( 0, 0, 0 );

	thirdPersonRenderer = new WebGLRenderer( { antialias: true } );
	thirdPersonRenderer.setPixelRatio( window.devicePixelRatio );
	thirdPersonRenderer.setSize( window.innerWidth, window.innerHeight );
	thirdPersonRenderer.setClearColor( 0x0f1416 );
	thirdPersonRenderer.outputEncoding = sRGBEncoding;

	document.body.appendChild( thirdPersonRenderer.domElement );
	thirdPersonRenderer.domElement.style.position = 'fixed';
	thirdPersonRenderer.domElement.style.left = '5px';
	thirdPersonRenderer.domElement.style.bottom = '5px';

	thirdPersonControls = new OrbitControls( thirdPersonCamera, thirdPersonRenderer.domElement );
	thirdPersonControls.screenSpacePanning = false;
	thirdPersonControls.minDistance = 1;
	thirdPersonControls.maxDistance = 2000;

	// controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.screenSpacePanning = false;
	controls.minDistance = 1;
	controls.maxDistance = 2000;

	// lights
	const dirLight = new DirectionalLight( 0xffffff );
	dirLight.position.set( 1, 2, 3 );
	scene.add( dirLight );

	const ambLight = new AmbientLight( 0xffffff, 0.2 );
	scene.add( ambLight );

	offsetParent = new Group();
	scene.add( offsetParent );

	// Raycasting init
	raycaster = new Raycaster();
	mouse = new Vector2();

	rayIntersect = new Group();

	const rayIntersectMat = new MeshBasicMaterial( { color: 0xe91e63 } );
	const rayMesh = new Mesh( new CylinderBufferGeometry( 0.25, 0.25, 6 ), rayIntersectMat );
	rayMesh.rotation.x = Math.PI / 2;
	rayMesh.position.z += 3;
	rayIntersect.add( rayMesh );

	const rayRing = new Mesh( new TorusBufferGeometry( 1.5, 0.2, 16, 100 ), rayIntersectMat );
	rayIntersect.add( rayRing );
	scene.add( rayIntersect );
	rayIntersect.visible = false;

	reinstantiateTiles();

	onWindowResize();
	window.addEventListener( 'resize', onWindowResize, false );
	renderer.domElement.addEventListener( 'mousemove', onMouseMove, false );
	renderer.domElement.addEventListener( 'mousedown', onMouseDown, false );
	renderer.domElement.addEventListener( 'mouseup', onMouseUp, false );
	renderer.domElement.addEventListener( 'mouseleave', onMouseLeave, false );

	secondRenderer.domElement.addEventListener( 'mousemove', onMouseMove, false );
	secondRenderer.domElement.addEventListener( 'mousedown', onMouseDown, false );
	secondRenderer.domElement.addEventListener( 'mouseup', onMouseUp, false );
	secondRenderer.domElement.addEventListener( 'mouseleave', onMouseLeave, false );


	// GUI
	const gui = new dat.GUI();
	gui.width = 300;

	const tileOptions = gui.addFolder( 'Tiles Options' );
	tileOptions.add( params, 'ionAssetId' );
	tileOptions.add( params, 'ionAccessToken' );
	tileOptions.add( params, 'preFetchToken' );
	tileOptions.add( params, 'loadSiblings' );
	tileOptions.add( params, 'stopAtEmptyTiles' );
	tileOptions.add( params, 'displayActiveTiles' );
	tileOptions.add( params, 'errorTarget' ).min( 0 ).max( 50 );
	tileOptions.add( params, 'errorThreshold' ).min( 0 ).max( 1000 );
	tileOptions.add( params, 'maxDepth' ).min( 1 ).max( 100 );
	tileOptions.add( params, 'up', [ '+Y', '+Z', '-Z' ] );
	tileOptions.open();

	const debug = gui.addFolder( 'Debug Options' );
	debug.add( params, 'displayBoxBounds' );
	debug.add( params, 'colorMode', {

		NONE,
		SCREEN_ERROR,
		GEOMETRIC_ERROR,
		DISTANCE,
		DEPTH,
		RELATIVE_DEPTH,
		IS_LEAF,
		RANDOM_COLOR,

	} );
	debug.open();

	const exampleOptions = gui.addFolder( 'Example Options' );
	exampleOptions.add( params, 'resolutionScale' ).min( 0.01 ).max( 2.0 ).step( 0.01 ).onChange( onWindowResize );
	exampleOptions.add( params, 'orthographic' );
	exampleOptions.add( params, 'showThirdPerson' );
	exampleOptions.add( params, 'showSecondView' ).onChange( onWindowResize );
	exampleOptions.add( params, 'enableUpdate' ).onChange( v => {

		tiles.parseQueue.autoUpdate = v;
		tiles.downloadQueue.autoUpdate = v;

		if ( v ) {

			tiles.parseQueue.scheduleJobRun();
			tiles.downloadQueue.scheduleJobRun();

		}

	} );
	exampleOptions.add( params, 'raycast', { NONE, ALL_HITS, FIRST_HIT_ONLY } );
	exampleOptions.add( params, 'enableCacheDisplay' );
	exampleOptions.add( params, 'enableRendererStats' );
	exampleOptions.open();

	gui.add( params, 'reload' );
	gui.open();

	statsContainer = document.createElement( 'div' );
	statsContainer.style.position = 'absolute';
	statsContainer.style.top = 0;
	statsContainer.style.left = 0;
	statsContainer.style.color = 'white';
	statsContainer.style.width = '100%';
	statsContainer.style.textAlign = 'center';
	statsContainer.style.padding = '5px';
	statsContainer.style.pointerEvents = 'none';
	statsContainer.style.lineHeight = '1.5em';
	document.body.appendChild( statsContainer );

	// Stats
	stats = new Stats();
	stats.showPanel( 0 );
	document.body.appendChild( stats.dom );

}

function onWindowResize() {

	thirdPersonCamera.aspect = window.innerWidth / window.innerHeight;
	thirdPersonCamera.updateProjectionMatrix();
	thirdPersonRenderer.setSize( Math.floor( window.innerWidth / 3 ), Math.floor( window.innerHeight / 3 ) );

	if ( params.showSecondView ) {

		camera.aspect = 0.5 * window.innerWidth / window.innerHeight;
		renderer.setSize( 0.5 * window.innerWidth, window.innerHeight );

		secondCamera.aspect = 0.5 * window.innerWidth / window.innerHeight;
		secondRenderer.setSize( 0.5 * window.innerWidth, window.innerHeight );
		secondRenderer.domElement.style.display = 'block';

	} else {

		camera.aspect = window.innerWidth / window.innerHeight;
		renderer.setSize( window.innerWidth, window.innerHeight );

		secondRenderer.domElement.style.display = 'none';

	}
	camera.updateProjectionMatrix();
	renderer.setPixelRatio( window.devicePixelRatio * params.resolutionScale );

	secondCamera.updateProjectionMatrix();
	secondRenderer.setPixelRatio( window.devicePixelRatio );

	updateOrthoCamera();

}

function onMouseLeave( e ) {

	lastHoveredElement = null;

}

function onMouseMove( e ) {

	const bounds = this.getBoundingClientRect();
	mouse.x = e.clientX - bounds.x;
	mouse.y = e.clientY - bounds.y;
	mouse.x = ( mouse.x / bounds.width ) * 2 - 1;
	mouse.y = - ( mouse.y / bounds.height ) * 2 + 1;

	lastHoveredElement = this;

}

const startPos = new Vector2();
const endPos = new Vector2();
function onMouseDown( e ) {

	const bounds = this.getBoundingClientRect();
	startPos.set( e.clientX - bounds.x, e.clientY - bounds.y );

}

function onMouseUp( e ) {

	const bounds = this.getBoundingClientRect();
	endPos.set( e.clientX - bounds.x, e.clientY - bounds.y );
	if ( startPos.distanceTo( endPos ) > 2 ) {

		return;

	}

	if ( lastHoveredElement === secondRenderer.domElement ) {

		raycaster.setFromCamera( mouse, secondCamera );

	} else {

		raycaster.setFromCamera( mouse, params.orthographic ? orthoCamera : camera );

	}

	raycaster.firstHitOnly = true;
	const results = raycaster.intersectObject( tiles.group, true );
	if ( results.length ) {

		const object = results[ 0 ].object;
		const info = tiles.getTileInformationFromActiveObject( object );

		let str = '';
		for ( const key in info ) {

			let val = info[ key ];
			if ( typeof val === 'number' ) {

				val = Math.floor( val * 1e5 ) / 1e5;

			}

			let name = key;
			while ( name.length < 20 ) {

				name += ' ';

			}

			str += `${ name } : ${ val }\n`;

		}
		console.log( str );

	}

}

function updateOrthoCamera() {

	orthoCamera.position.copy( camera.position );
	orthoCamera.rotation.copy( camera.rotation );

	const scale = camera.position.distanceTo( controls.target ) / 2.0;
	let aspect = window.innerWidth / window.innerHeight;
	if ( params.showSecondView ) {

		aspect *= 0.5;

	}
	orthoCamera.left = - aspect * scale;
	orthoCamera.right = aspect * scale;
	orthoCamera.bottom = - scale;
	orthoCamera.top = scale;
	orthoCamera.near = camera.near;
	orthoCamera.far = camera.far;
	orthoCamera.updateProjectionMatrix();

}

function animate() {

	requestAnimationFrame( animate );

	if ( ! tiles ) return;

	// update options
	tiles.errorTarget = params.errorTarget;
	tiles.errorThreshold = params.errorThreshold;
	tiles.loadSiblings = params.loadSiblings;
	tiles.stopAtEmptyTiles = params.stopAtEmptyTiles;
	tiles.displayActiveTiles = params.displayActiveTiles;
	tiles.maxDepth = params.maxDepth;
	tiles.displayBoxBounds = params.displayBoxBounds;
	tiles.colorMode = parseFloat( params.colorMode );

	if ( params.orthographic ) {

		tiles.deleteCamera( camera );
		tiles.setCamera( orthoCamera );
		tiles.setResolutionFromRenderer( orthoCamera, renderer );

	} else {

		tiles.deleteCamera( orthoCamera );
		tiles.setCamera( camera );
		tiles.setResolutionFromRenderer( camera, renderer );

	}

	if ( params.showSecondView ) {

		tiles.setCamera( secondCamera );
		tiles.setResolutionFromRenderer( secondCamera, secondRenderer );

	} else {

		tiles.deleteCamera( secondCamera );

	}

	offsetParent.rotation.set( 0, 0, 0 );
	if ( params.up === '-Z' ) {

		offsetParent.rotation.x = Math.PI / 2;

	} else if ( params.up === '+Z' ) {

		offsetParent.rotation.x = - Math.PI / 2;

	}

	offsetParent.updateMatrixWorld( true );

	if ( parseFloat( params.raycast ) !== NONE && lastHoveredElement !== null ) {

		if ( lastHoveredElement === renderer.domElement ) {

			raycaster.setFromCamera( mouse, params.orthographic ? orthoCamera : camera );

		} else {

			raycaster.setFromCamera( mouse, secondCamera );

		}

		raycaster.firstHitOnly = parseFloat( params.raycast ) === FIRST_HIT_ONLY;

		const results = raycaster.intersectObject( tiles.group, true );
		if ( results.length ) {

			const closestHit = results[ 0 ];
			const point = closestHit.point;
			rayIntersect.position.copy( point );

			// If the display bounds are visible they get intersected
			if ( closestHit.face ) {

				const normal = closestHit.face.normal;
				normal.transformDirection( closestHit.object.matrixWorld );
				rayIntersect.lookAt(
					point.x + normal.x,
					point.y + normal.y,
					point.z + normal.z
				);

			}

			rayIntersect.visible = true;

		} else {

			rayIntersect.visible = false;

		}

	} else {

		rayIntersect.visible = false;

	}

	// update tiles
	window.tiles = tiles;
	if ( params.enableUpdate ) {

		secondCamera.updateMatrixWorld();
		camera.updateMatrixWorld();
		orthoCamera.updateMatrixWorld();
		tiles.update();

	}

	render();
	stats.update();

}

function render() {

	updateOrthoCamera();

	cameraHelper.visible = false;
	orthoCameraHelper.visible = false;
	secondCameraHelper.visible = false;

	// render primary view
	if ( params.orthographic ) {

		const dist = orthoCamera.position.distanceTo( rayIntersect.position );
		rayIntersect.scale.setScalar( dist / 150 );

	} else {

		const dist = camera.position.distanceTo( rayIntersect.position );
		rayIntersect.scale.setScalar( dist * camera.fov / 6000 );

	}
	renderer.render( scene, params.orthographic ? orthoCamera : camera );

	// render secondary view
	if ( params.showSecondView ) {

		const dist = secondCamera.position.distanceTo( rayIntersect.position );
		rayIntersect.scale.setScalar( dist * secondCamera.fov / 6000 );
		secondRenderer.render( scene, secondCamera );

	}

	// render third person view
	thirdPersonRenderer.domElement.style.visibility = params.showThirdPerson ? 'visible' : 'hidden';
	if ( params.showThirdPerson ) {

		cameraHelper.update();
		cameraHelper.visible = ! params.orthographic;

		orthoCameraHelper.update();
		orthoCameraHelper.visible = params.orthographic;

		if ( params.showSecondView ) {

			secondCameraHelper.update();
			secondCameraHelper.visible = true;

		}

		const dist = thirdPersonCamera.position.distanceTo( rayIntersect.position );
		rayIntersect.scale.setScalar( dist * thirdPersonCamera.fov / 6000 );
		thirdPersonRenderer.render( scene, thirdPersonCamera );

	}

	const cacheFullness = tiles.lruCache.itemList.length / tiles.lruCache.maxSize;
	let str = `Downloading: ${ tiles.stats.downloading } Parsing: ${ tiles.stats.parsing } Visible: ${ tiles.group.children.length - 2 }`;

	if ( params.enableCacheDisplay ) {

		const geomSet = new Set();
		tiles.traverse( tile => {

			const scene = tile.cached.scene;
			if ( scene ) {

				scene.traverse( c => {

					if ( c.geometry ) {

						geomSet.add( c.geometry );

					}

				} );

			}

		} );

		let count = 0;
		geomSet.forEach( g => {

			count += BufferGeometryUtils.estimateBytesUsed( g );

		} );
		str += `<br/>Cache: ${ ( 100 * cacheFullness ).toFixed( 2 ) }% ~${ ( count / 1000 / 1000 ).toFixed( 2 ) }mb`;

	}

	if ( params.enableRendererStats ) {

		const memory = renderer.info.memory;
		const programCount = renderer.info.programs.length;
		str += `<br/>Geometries: ${ memory.geometries } Textures: ${ memory.textures } Programs: ${ programCount }`;

	}

	if ( statsContainer.innerHTML !== str ) {

		statsContainer.innerHTML = str;

	}

}