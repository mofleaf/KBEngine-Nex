import time

from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt

from KBESettings import settings
from pycommon import Define, Machines

from utils import kbe_util
from webconsole.machines_mgr import machinesmgr
from webconsole.models import KBEUserExtension


# Create your views here.
def server_shutdown(request):
    """
    停止服务器
    """
    COMPS_FOR_SHUTDOWN = [
        Define.BOTS_TYPE,
        Define.LOGINAPP_TYPE,
        Define.CELLAPP_TYPE,
        Define.BASEAPP_TYPE,
        Define.CELLAPPMGR_TYPE,
        Define.BASEAPPMGR_TYPE,
        Define.DBMGR_TYPE,
        Define.INTERFACES_TYPE,
        Define.LOGGER_TYPE,
    ]

    ext = KBEUserExtension.objects.get(user=request.user)
    system_user_uid = 0 if ext.system_user_uid is None else int(ext.system_user_uid)
    system_username = "" if ext.system_user_uid is None else ext.system_username

    components = Machines.Machines(system_user_uid, system_username)

    for ctid in COMPS_FOR_SHUTDOWN:
        hosts = kbe_util.get_machines_address()
        components.stopServer(ctid, trycount=0, targetIP=hosts)
    context = {
        "shutType": "all_ct"
    }
    return render(request, "cluster/server_shutdown.html", context)


def server_kill(request, ct, cid):
    """
    杀死一个组件进程
    """
    ct = int(ct)
    cid = int(cid)

    ext = KBEUserExtension.objects.get(user=request.user)
    system_user_uid = 0 if ext.system_user_uid is None else int(ext.system_user_uid)
    system_username = "" if ext.system_user_uid is None else ext.system_username

    components = Machines.Machines(system_user_uid, system_username)
    hosts = kbe_util.get_machines_address()
    components.killServer(ct, componentID=cid, trycount=0, targetIP=hosts)
    context = {
        "shutType": "kill_cid",
        "ct": ct,
        "cid": cid
    }
    return render(request, "cluster/server_kill.html", context)


def server_run(request):
    """
    运行组件
    """
    components = Machines.Machines(request.session["sys_uid"], request.session["sys_user"])
    context = {}

    POST = request.POST
    if POST.get("run", ""):
        componentType = int(POST.get("componentType", "0"))
        targetMachine = POST.get("targetMachine", "").strip()
        runNumber = int(POST.get("runNumber", "0"))
        kbe_root = request.session["kbe_root"]
        kbe_res_path = request.session["kbe_res_path"]
        kbe_bin_path = request.session["kbe_bin_path"]

        if componentType not in Define.VALID_COMPONENT_TYPE_FOR_RUN or \
                not machinesmgr.hasMachine(targetMachine) or \
                runNumber <= 0:
            context = {"error": "invalid data!"}
        else:
            for e in range(runNumber):
                cid = machinesmgr.makeCID(componentType)
                gus = machinesmgr.makeGUS(componentType)
                print("cid: %s, gus: %s" % (cid, gus))
                components.startServer(componentType, cid, gus, targetMachine, kbe_root, kbe_res_path, kbe_bin_path)

            time.sleep(2)
            return HttpResponseRedirect("/wc/components/manage")

    context["machines"] = machinesmgr.machines

    return render(request, "WebConsole/components_run.html", context)


def server_stop(request, ct, cid):
    """
    停止一个组件
    """
    ct = int(ct)
    cid = int(cid)

    ext = KBEUserExtension.objects.get(user=request.user)
    system_user_uid = 0 if ext.system_user_uid is None else int(ext.system_user_uid)
    system_username = "" if ext.system_user_uid is None else ext.system_username

    components = Machines.Machines(system_user_uid, system_username)

    hosts = kbe_util.get_machines_address()

    components.stopServer(ct, componentID=cid, trycount=0, targetIP=hosts)
    context = {
        "shutType": "stop_cid",
        "ct": ct,
        "cid": cid
    }
    return render(request, "cluster/server_shutdown.html", context)


def server_query(request):
    """
    请求获取组件数据
    """
    ext = KBEUserExtension.objects.get(user=request.user)
    system_user_uid = 0 if ext.system_user_uid is None else int(ext.system_user_uid)
    system_username = "" if ext.system_user_uid is None else ext.system_username

    interfaces_groups = machinesmgr.queryAllInterfaces(system_user_uid, system_username)

    # [ [machine, other-components, ...], ...]
    kbeComps = []
    for mID, comps in interfaces_groups.items():
        if len(comps) <= 1:
            continue

        dl = []
        kbeComps.append(dl)
        for comp in comps:
            d = {
                "ip": comp.intaddr,
                "componentType": comp.componentType,
                "componentName": comp.componentName,
                "fullname": comp.fullname,
                "uid": comp.uid,
                "pid": comp.pid,
                "componentID": comp.componentID,
                "globalOrderID": comp.globalOrderID,
                "cpu": comp.cpu,
                "mem": comp.mem,
                "usedmem": comp.usedmem,
                "entities": comp.entities,
                "proxies": comp.proxies,
                "clients": comp.clients,
                "consolePort": comp.consolePort,
            }
            dl.append(d)

    return JsonResponse(kbeComps, safe=False)


def server_one_query(request, ct, cid):
    """
    请求获取一个组件数据
    """

    ext = KBEUserExtension.objects.get(user=request.user)
    system_user_uid = 0 if ext.system_user_uid is None else int(ext.system_user_uid)
    system_username = "" if ext.system_user_uid is None else ext.system_username

    ct = int(ct)
    cid = int(cid)
    interfaces_groups = machinesmgr.queryAllInterfaces(system_user_uid, system_username)
    # [ [machine, other-components, ...], ...]
    kbeComps = []
    for mID, comps in interfaces_groups.items():
        if len(comps) <= 1:
            continue

        dl = []
        kbeComps.append(dl)
        for comp in comps:
            if comp.componentType == 8:
                d = {
                    "ip": comp.intaddr,
                    "componentType": comp.componentType,
                    "componentName": comp.componentName,
                    "fullname": comp.fullname,
                    "uid": comp.uid,
                    "pid": comp.pid,
                    "componentID": comp.componentID,
                    "globalOrderID": comp.globalOrderID,
                    "cpu": comp.cpu,
                    "mem": comp.mem,
                    "usedmem": comp.usedmem,
                    "entities": comp.entities,
                    "proxies": comp.proxies,
                    "clients": comp.clients,
                    "consolePort": comp.consolePort,
                }
                dl.append(d)

            if comp.componentID == cid:
                d = {
                    "ip": comp.intaddr,
                    "componentType": comp.componentType,
                    "componentName": comp.componentName,
                    "fullname": comp.fullname,
                    "uid": comp.uid,
                    "pid": comp.pid,
                    "componentID": comp.componentID,
                    "globalOrderID": comp.globalOrderID,
                    "cpu": comp.cpu,
                    "mem": comp.mem,
                    "usedmem": comp.usedmem,
                    "entities": comp.entities,
                    "proxies": comp.proxies,
                    "clients": comp.clients,
                    "consolePort": comp.consolePort,
                }
                dl.append(d)

            if ct == 3:
                if comp.componentType == 6 or comp.componentType == 3:
                    d = {
                        "ip": comp.intaddr,
                        "componentType": comp.componentType,
                        "componentName": comp.componentName,
                        "fullname": comp.fullname,
                        "uid": comp.uid,
                        "pid": comp.pid,
                        "componentID": comp.componentID,
                        "globalOrderID": comp.globalOrderID,
                        "cpu": comp.cpu,
                        "mem": comp.mem,
                        "usedmem": comp.usedmem,
                        "entities": comp.entities,
                        "proxies": comp.proxies,
                        "clients": comp.clients,
                        "consolePort": comp.consolePort,
                    }
                    dl.append(d)

            if ct == 4:
                if comp.componentType == 5 or comp.componentType == 4:
                    d = {
                        "ip": comp.intaddr,
                        "componentType": comp.componentType,
                        "componentName": comp.componentName,
                        "fullname": comp.fullname,
                        "uid": comp.uid,
                        "pid": comp.pid,
                        "componentID": comp.componentID,
                        "globalOrderID": comp.globalOrderID,
                        "cpu": comp.cpu,
                        "mem": comp.mem,
                        "usedmem": comp.usedmem,
                        "entities": comp.entities,
                        "proxies": comp.proxies,
                        "clients": comp.clients,
                        "consolePort": comp.consolePort,
                    }
                    dl.append(d)

    return JsonResponse(kbeComps, safe=False)
