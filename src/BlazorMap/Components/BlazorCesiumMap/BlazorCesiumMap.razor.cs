namespace BlazorMap;

public partial class BlazorCesiumMap
{
    protected override string JsModulePath => "./_content/BlazorMap/js/blazorCesiumMap.js";

    protected override object ToMapOptionsPayload(BlazorCesiumMapOptions o) =>
        new
        {
            center               = new { lat = o.Center.Latitude, lng = o.Center.Longitude },
            altitude             = o.Altitude,
            terrainEnabled       = o.TerrainEnabled,
            imageryStyle         = o.ImageryStyle,
            ionAccessToken       = o.IonAccessToken,
            sceneMode            = o.SceneMode,
            animationWidget      = o.AnimationWidget,
            timelineWidget       = o.TimelineWidget,
            baseLayerPicker      = o.BaseLayerPicker,
            navigationHelpButton = o.NavigationHelpButton,
            homeButton           = o.HomeButton,
            fullscreenButton     = o.FullscreenButton,
            geocoder             = o.Geocoder,
            infoBox              = o.InfoBox,
            shadowsEnabled       = o.ShadowsEnabled,
        };

    protected override BlazorCesiumMapOptions CloneOptions(BlazorCesiumMapOptions o) =>
        new()
        {
            Center               = o.Center,
            Altitude             = o.Altitude,
            TerrainEnabled       = o.TerrainEnabled,
            ImageryStyle         = o.ImageryStyle,
            IonAccessToken       = o.IonAccessToken,
            SceneMode            = o.SceneMode,
            AnimationWidget      = o.AnimationWidget,
            TimelineWidget       = o.TimelineWidget,
            BaseLayerPicker      = o.BaseLayerPicker,
            NavigationHelpButton = o.NavigationHelpButton,
            HomeButton           = o.HomeButton,
            FullscreenButton     = o.FullscreenButton,
            Geocoder             = o.Geocoder,
            InfoBox              = o.InfoBox,
            ShadowsEnabled       = o.ShadowsEnabled,
        };

    protected override bool OptionsEqual(BlazorCesiumMapOptions a, BlazorCesiumMapOptions b) =>
        a.Center.Equals(b.Center)
        && Math.Abs(a.Altitude - b.Altitude) < 1.0
        && a.TerrainEnabled       == b.TerrainEnabled
        && a.ImageryStyle         == b.ImageryStyle
        && a.IonAccessToken       == b.IonAccessToken
        && a.SceneMode            == b.SceneMode
        && a.AnimationWidget      == b.AnimationWidget
        && a.TimelineWidget       == b.TimelineWidget
        && a.BaseLayerPicker      == b.BaseLayerPicker
        && a.NavigationHelpButton == b.NavigationHelpButton
        && a.HomeButton           == b.HomeButton
        && a.FullscreenButton     == b.FullscreenButton
        && a.Geocoder             == b.Geocoder
        && a.InfoBox              == b.InfoBox
        && a.ShadowsEnabled       == b.ShadowsEnabled;
}
