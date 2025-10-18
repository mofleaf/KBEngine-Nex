from django.urls import re_path

from cluster import consumers
from component.ws.space_viewer_process_cmd import SpaceViewerProcessCmdConsumer, SpaceViewerCellProcessCmdConsumer

websocket_urlpatterns = [
    # re_path(r"ws/server_manage/$", consumers.LogConsumer.as_asgi()),
    re_path(r"^ws/server_manage/$", consumers.LogConsumer.as_asgi()),
    re_path(r"ws/space_viewer_process_cmd/$", SpaceViewerProcessCmdConsumer.as_asgi()),
    re_path(r"ws/space_viewer_cell_process_cmd/$", SpaceViewerCellProcessCmdConsumer.as_asgi()),
]