# ---------------- 源文件 ----------------
set(SRCS
	DetourAlloc.cpp
	DetourAssert.cpp
	DetourCommon.cpp
	DetourNavMesh.cpp
	DetourNavMeshBuilder.cpp
	DetourNavMeshQuery.cpp
	DetourNode.cpp
	DetourCrowd.cpp
	DetourLocalBoundary.cpp
	DetourObstacleAvoidance.cpp
	DetourPathCorridor.cpp
	DetourPathQueue.cpp
	DetourProximityGrid.cpp
	DetourTileCache.cpp
	DetourTileCacheBuilder.cpp
	navigation.cpp
	navigation_handle.cpp
	navigation_tile_handle.cpp
	navigation_mesh_handle.cpp
	Recast.cpp
	RecastAlloc.cpp
	RecastArea.cpp
	RecastAssert.cpp
	RecastContour.cpp
	RecastFilter.cpp
	RecastLayers.cpp
	RecastMesh.cpp
	RecastMeshDetail.cpp
	RecastRasterization.cpp
	RecastRegion.cpp
)
# ---------------- 创建静态库 ----------------
add_library(navigation STATIC ${SRCS})



target_link_libraries(navigation PRIVATE fmt::fmt)


