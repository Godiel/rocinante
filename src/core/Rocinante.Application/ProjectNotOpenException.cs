namespace Rocinante.Application;

/// <summary>The request needs an open project and there is none.</summary>
public sealed class ProjectNotOpenException() : Exception("No project is open.");
