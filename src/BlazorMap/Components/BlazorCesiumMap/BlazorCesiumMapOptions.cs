namespace BlazorMap;

/// <summary>Display and interaction options for <see cref="BlazorCesiumMap"/>.</summary>
public sealed class BlazorCesiumMapOptions
{
    /// <summary>Initial camera look-at centre in geographic coordinates.</summary>
    public BlazorMapLatLng Center { get; set; } = new(20, 0);

    /// <summary>
    /// Camera altitude above the Earth's surface in metres.
    /// Large values (e.g. <c>15_000_000</c> m) show the whole globe;
    /// small values (e.g. <c>500_000</c> m) give a regional view.
    /// </summary>
    public double Altitude { get; set; } = 15_000_000;

    /// <summary>
    /// Enable Cesium World Terrain (requires a valid <see cref="IonAccessToken"/>).
    /// </summary>
    public bool TerrainEnabled { get; set; }

    /// <summary>
    /// Base imagery style.
    /// <list type="bullet">
    ///   <item><c>"osm"</c> — OpenStreetMap tiles (default, no token required).</item>
    ///   <item><c>"bing_aerial"</c> — Bing Aerial imagery (requires <see cref="IonAccessToken"/>).</item>
    ///   <item><c>"bing_labels"</c> — Bing Aerial with road labels (requires <see cref="IonAccessToken"/>).</item>
    ///   <item><c>"none"</c> — blank dark globe (no base layer).</item>
    /// </list>
    /// </summary>
    public string ImageryStyle { get; set; } = "osm";

    /// <summary>
    /// Cesium ion access token.
    /// Required for terrain, Bing imagery, and any Cesium ion asset.
    /// Obtain a free token at <see href="https://cesium.com/ion/"/>.
    /// Without a token the viewer initialises with OpenStreetMap tiles and no terrain.
    /// </summary>
    public string? IonAccessToken { get; set; }

    /// <summary>
    /// Scene rendering mode.
    /// <list type="bullet">
    ///   <item><c>"scene3d"</c> (default) — full 3-D globe view.</item>
    ///   <item><c>"scene2d"</c> — flat projected map.</item>
    ///   <item><c>"columbus"</c> — Columbus-view (tilted 2.5-D).</item>
    /// </list>
    /// </summary>
    public string SceneMode { get; set; } = "scene3d";

    /// <summary>Show the Cesium animation clock widget (bottom-left).</summary>
    public bool AnimationWidget { get; set; }

    /// <summary>Show the Cesium timeline widget (bottom).</summary>
    public bool TimelineWidget { get; set; }

    /// <summary>Show the base-layer picker widget (top-right).</summary>
    public bool BaseLayerPicker { get; set; }

    /// <summary>Show the navigation-help button widget (top-right).</summary>
    public bool NavigationHelpButton { get; set; } = true;

    /// <summary>Show the home button widget (top-left).</summary>
    public bool HomeButton { get; set; } = true;

    /// <summary>Show the fullscreen button (top-right).</summary>
    public bool FullscreenButton { get; set; }

    /// <summary>Show the geocoder (search) widget (top-right).</summary>
    public bool Geocoder { get; set; }

    /// <summary>
    /// Show the entity info box when a marker or feature is selected.
    /// Content comes from <see cref="BlazorMapMarkerModel.PopupHtml"/>.
    /// </summary>
    public bool InfoBox { get; set; } = true;

    /// <summary>Enable sun shadows cast on terrain and models.</summary>
    public bool ShadowsEnabled { get; set; }
}
