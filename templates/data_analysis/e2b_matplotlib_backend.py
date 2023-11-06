from time import strftime

from matplotlib.backend_bases import Gcf
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.backend_bases import FigureManagerBase

dateformat = '%Y%m%d-%H%M%S'
FigureCanvas = FigureCanvasAgg

class FigureManager(FigureManagerBase):
    def show(self):
        self.canvas.figure.savefig(f'/home/user/artifacts/figure_{strftime(dateformat)}.png')


def show(*args, **kwargs):
    for _, figmanager in enumerate(Gcf.get_all_fig_managers()):
        figmanager.canvas.figure.savefig(f'/home/user/artifacts/figure_{strftime(dateformat)}.png')