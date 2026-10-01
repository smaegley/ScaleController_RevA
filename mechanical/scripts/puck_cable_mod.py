# Builds LoadCell_Puck_modC.step and LoadCell_Puck_modC_cutters.step from LoadCell_Puck.step.
# Needs: pip install cadquery-ocp numpy.  Run: python mechanical/scripts/puck_cable_mod.py
# Values mirror CableMod_Parameters.csv (Fusion). Model coords: mm, Y up, lead channel along +Z.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
# Rev A of the puck cable mods. Model coords: mm, Y up, lead channel along +Z at x=0.
from step_io import *
from OCP.gp import gp_Pnt, gp_Ax2, gp_Dir
from OCP.BRepPrimAPI import BRepPrimAPI_MakeBox, BRepPrimAPI_MakeCylinder
from OCP.BRepAlgoAPI import BRepAlgoAPI_Cut, BRepAlgoAPI_Fuse, BRepAlgoAPI_Common
from OCP.STEPControl import STEPControl_Writer, STEPControl_AsIs
from OCP.Interface import Interface_Static
P=dict(
  face=2.6,            # bottom top face
  rim=39.0,
  # splice pocket
  pk_w=10.0, pk_z0=19.5, pk_z1=32.0, pk_floor=-2.0,
  # cable groove (round, along Z)
  cab_d=4.6, cab_y=-2.3, gr_z0=29.0,
  # clamp-bar recess
  rc_w=20.0, rc_z0=32.0, rc_floor=0.0,
  # heat-set inserts M2 x 6 long x 3.5 OD (hole d3.2 x 7 deep), screws at x=+-ins_x, z=ins_z
  ins_d=3.2, ins_depth=7.0, ins_x=6.0, ins_z=35.0,
  # bar: fills recess flush with face, 2 transverse ridges
  # overload stop: fixed pads on the bottom face, top lands on them after stop_gap of travel
  top_under=7.35, stop_gap=0.5, pad_r0=31.0, pad_r1=37.0, pad_half_deg=10.0,
  pad_deg=(0,55,125,180,230,310),   # atan2(z,x); cable is at 90, posts at 30/150/270
  bar_clear=0.25,          # = Fusion clr
  bar_hole=2.4, ridge_h=1.0, ridge_w=1.0, ridge_z=(33.5,36.6), ridge_len=7.0,
)
def box(x0,y0,z0,x1,y1,z1): return BRepPrimAPI_MakeBox(gp_Pnt(x0,y0,z0),gp_Pnt(x1,y1,z1)).Shape()
def cylZ(x,y,z0,r,l): return BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x,y,z0),gp_Dir(0,0,1)),r,l).Shape()
def cylY(x,z,y0,r,l): return BRepPrimAPI_MakeCylinder(gp_Ax2(gp_Pnt(x,y0,z),gp_Dir(0,1,0)),r,l).Shape()
def fuse(*s):
    a=s[0]
    for b in s[1:]: a=BRepAlgoAPI_Fuse(a,b).Shape()
    return a
p=P; top_of_world=p['face']+0.5; out=p['rim']+2
pocket=box(-p['pk_w']/2,p['pk_floor'],p['pk_z0'], p['pk_w']/2,top_of_world,p['pk_z1'])
groove=fuse(cylZ(0,p['cab_y'],p['gr_z0'],p['cab_d']/2,out-p['gr_z0']),
            box(-p['cab_d']/2,p['cab_y'],p['gr_z0'], p['cab_d']/2,top_of_world,out))   # open-topped U
recess=box(-p['rc_w']/2,p['rc_floor'],p['rc_z0'], p['rc_w']/2,top_of_world,out)
inserts=fuse(*[cylY(sx*p['ins_x'],p['ins_z'],p['rc_floor']-p['ins_depth'],p['ins_d']/2,p['ins_depth']+1) for sx in (-1,1)])
cutters={'cut_splice_pocket':pocket,'cut_cable_groove':groove,'cut_clamp_recess':recess,'cut_insert_holes':inserts}
parts=load(os.path.join(D,'LoadCell_Puck.step'))
bottom=parts[0][1]
newb=bottom
for c in cutters.values(): newb=BRepAlgoAPI_Cut(newb,c).Shape()
# clamp bar: recess footprint minus clearance, clipped to the rim circle
c=p['bar_clear']
bar=box(-p['rc_w']/2+c,p['rc_floor'],p['rc_z0']+c, p['rc_w']/2-c,p['face'],out)
disc=cylY(0,0,-20,p['rim']-c,40)
bar=BRepAlgoAPI_Common(bar,disc).Shape()
for rz in p['ridge_z']:
    bar=fuse(bar,box(-p['ridge_len']/2,p['rc_floor']-p['ridge_h'],rz-p['ridge_w']/2, p['ridge_len']/2,p['rc_floor']+0.01,rz+p['ridge_w']/2))
for sx in (-1,1): bar=BRepAlgoAPI_Cut(bar,cylY(sx*p['ins_x'],p['ins_z'],-5,p['bar_hole']/2,15)).Shape()
import math
from OCP.gp import gp_Dir as D_
pads=[]
for a in p['pad_deg']:
    # sector cylinder about +Y sweeps from Xdir toward -Z (decreasing atan2(z,x)), so start at a+half
    st=math.radians(a+p['pad_half_deg'])
    ax=gp_Ax2(gp_Pnt(0,p['face'],0),D_(0,1,0),D_(math.cos(st),0,math.sin(st)))
    h=p['top_under']-p['stop_gap']-p['face']
    outer=BRepPrimAPI_MakeCylinder(ax,p['pad_r1'],h,math.radians(2*p['pad_half_deg'])).Shape()
    inner=BRepPrimAPI_MakeCylinder(ax,p['pad_r0'],h).Shape()
    pads.append(BRepAlgoAPI_Cut(outer,inner).Shape())
for pd in pads: newb=BRepAlgoAPI_Fuse(newb,pd).Shape()
named=[('Puck_Bottom_modC',newb),('Puck_Top',parts[1][1]),('Clamp_Bar',bar)]+[(f'cell_{k}',parts[k][1]) for k in range(2,8)]
def write(fn,items):
    from OCP.TDocStd import TDocStd_Document
    from OCP.TCollection import TCollection_ExtendedString
    from OCP.XCAFDoc import XCAFDoc_DocumentTool
    from OCP.TDataStd import TDataStd_Name
    from OCP.STEPCAFControl import STEPCAFControl_Writer
    doc=TDocStd_Document(TCollection_ExtendedString("XmlOcaf"))
    st=XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    for n,s in items:
        l=st.AddShape(s,False); TDataStd_Name.Set_s(l,TCollection_ExtendedString(n))
    Interface_Static.SetCVal_s('write.step.unit','MM')
    w=STEPCAFControl_Writer(); w.SetNameMode(True); w.Transfer(doc,STEPControl_AsIs); w.Write(fn)
import sys
write(os.path.join(D,'LoadCell_Puck_modC.step'),named)
write(os.path.join(D,'LoadCell_Puck_modC_cutters.step'),list(cutters.items()))
print('bottom vol', round(vol(bottom),1),'->',round(vol(newb),1),' bar vol',round(vol(bar),1))
