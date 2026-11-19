using Rocinante.Domain.Content;
using Rocinante.Domain.Projects;

namespace Rocinante.Application;

/// <summary>The open project as the windows see it: its file, its index and the counts of the work.</summary>
public sealed record ProjectSnapshot(string Path, Project Project, TextStatistics Work);
