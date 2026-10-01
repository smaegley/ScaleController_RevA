import numpy as np
from OCP.STEPControl import STEPControl_Reader
from OCP.StepRepr import StepRepr_RepresentationItem
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_SOLID
from OCP.BRep import BRep_Tool
from OCP.TopLoc import TopLoc_Location
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.GProp import GProp_GProps
from OCP.BRepGProp import BRepGProp
from OCP.TopoDS import TopoDS
def load(path):
    r=STEPControl_Reader(); r.ReadFile(path); r.TransferRoots(); sh=r.OneShape()
    tr=r.WS().TransferReader(); out=[]
    e=TopExp_Explorer(sh,TopAbs_SOLID)
    while e.More():
        so=e.Current(); ent=tr.EntityFromShapeResult(so,1); n='?'
        if ent is not None:
            try: n=StepRepr_RepresentationItem.DownCast(ent).Name().ToCString()
            except Exception: pass
        out.append((n,so)); e.Next()
    return out
def bbox(sh):
    b=Bnd_Box(); BRepBndLib.AddOptimal_s(sh,b,False,False); p,q=b.CornerMin(),b.CornerMax(); return np.array([p.X(),p.Y(),p.Z(),q.X(),q.Y(),q.Z()])
def vol(sh):
    p=GProp_GProps(); BRepGProp.VolumeProperties_s(sh,p); return p.Mass()
def mesh(sh,defl=0.05):
    BRepMesh_IncrementalMesh(sh,defl,False,0.3,True)
    V=[];F=[];e=TopExp_Explorer(sh,TopAbs_FACE)
    while e.More():
        f=TopoDS.Face(e.Current()); loc=TopLoc_Location()
        t=BRep_Tool.Triangulation_s(f,loc)
        if t:
            tr=loc.Transformation(); o=len(V)
            for i in range(1,t.NbNodes()+1):
                p=t.Node(i).Transformed(tr); V.append((p.X(),p.Y(),p.Z()))
            from OCP.TopAbs import TopAbs_REVERSED; rev=f.Orientation()==TopAbs_REVERSED
            for i in range(1,t.NbTriangles()+1):
                a,b,c=t.Triangle(i).Get()
                F.append((o+a-1,o+c-1,o+b-1) if rev else (o+a-1,o+b-1,o+c-1))
        e.Next()
    return np.array(V),np.array(F)
