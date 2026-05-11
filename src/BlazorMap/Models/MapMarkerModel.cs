namespace BlazorMap;

/// <summary>Declarative marker definition for batch updates.</summary>
public sealed class MapMarkerModel
{
    public required string Id { get; init; }
    public required LatLng Position { get; init; }
    public string? PopupHtml { get; init; }
    public string? Title { get; init; }
    public bool Draggable { get; init; }
    public string? IconUrl { get; init; }
    public int? IconWidth { get; init; }
    public int? IconHeight { get; init; }

    /// <summary>Hover tooltip (Leaflet <c>bindTooltip</c>); distinct from popup HTML which opens on click.</summary>
    public string? TooltipHtml { get; init; }

    /// <summary>When true, tooltip stays visible (use sparingly).</summary>
    public bool TooltipPermanent { get; init; }

    /// <summary>Leaflet tooltip direction, e.g. <c>top</c>, <c>bottom</c>, <c>auto</c>.</summary>
    public string? TooltipDirection { get; init; }

    /// <summary>Stack order for overlapping markers.</summary>
    public int ZIndexOffset { get; init; }
}
