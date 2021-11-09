from pathlib import Path
import subprocess
import zipfile

from hat.doit import common


__all__ = ['task_dist_windows']


package_path = Path(__file__).parent

build_dir = Path('build')
cache_dir = Path('cache')
readme_path = Path('README.rst')
license_path = Path('LICENSE')
version_path = Path('VERSION')

dist_dir = build_dir / 'dist'
dist_windows_dir = dist_dir / f'hat-manager-{common.get_version()}-windows'

win_python_url = 'https://www.python.org/ftp/python/3.9.7/python-3.9.7-embed-amd64.zip'  # NOQA
cache_win_python_path = cache_dir / win_python_url.split('/')[-1]


def task_dist_windows():
    """Create Windows distribution"""

    def create():
        common.rm_rf(dist_windows_dir)
        common.mkdir_p(dist_windows_dir.parent)
        common.cp_r(package_path / 'windows', dist_windows_dir)

        common.cp_r(readme_path, dist_windows_dir / 'README.txt')
        common.cp_r(license_path, dist_windows_dir / 'LICENSE.txt')
        common.cp_r(version_path, dist_windows_dir / 'VERSION.txt')

        common.mkdir_p(cache_dir)
        if not cache_win_python_path.exists():
            subprocess.run(['curl', '-s',
                            '-o', str(cache_win_python_path),
                            '-L', win_python_url],
                           check=True)

        python_dir = dist_windows_dir / 'python'
        common.mkdir_p(python_dir)
        with zipfile.ZipFile(str(cache_win_python_path)) as f:
            f.extractall(str(python_dir))

        python_lib_path = python_dir / 'python39.zip'
        python_lib_dir = python_dir / 'lib'
        common.mkdir_p(python_lib_dir)
        with zipfile.ZipFile(str(python_lib_path)) as f:
            f.extractall(str(python_lib_dir))
        common.rm_rf(python_lib_path)

        (python_dir / 'python39._pth').write_text(
            '..\\packages\n'
            'lib\n'
            '.\n'
            'import site\n'
        )

        packages_dir = dist_windows_dir / 'packages'
        common.mkdir_p(packages_dir)

        packages = (str(i) for i in (build_dir / 'py/dist').glob('*.whl'))
        subprocess.run(['pip', 'install', '-q',
                        '-t', str(packages_dir),
                        '--only-binary=:all:',
                        '--platform', 'win_amd64',
                        *packages],
                       check=True)

        zip_path = dist_dir / f'{dist_windows_dir.name}.zip'
        common.rm_rf(zip_path)
        with zipfile.ZipFile(str(zip_path), 'w', zipfile.ZIP_DEFLATED) as f:
            for i in dist_windows_dir.rglob('*'):
                if i.is_dir():
                    continue
                f.write(str(i), str(i.relative_to(dist_windows_dir)))

    return {'actions': [create],
            'task_dep': ['build']}
