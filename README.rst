hat-manager - Device management GUI
===================================

This component is part of Hat Open project - open-source framework of tools and
libraries for developing applications used for remote monitoring, control and
management of intelligent electronic devices such as IoT devices, PLCs,
industrial automation or home automation systems.

Development of Hat Open and associated repositories is sponsored by
Končar - Power Plant and Electric Traction Engineering Inc.
(Končar KET - `<https://www.koncar-ket.hr>`_).

For more information see:

    * hat-manager documentation - `<https://hat-manager.hat-open.com>`_
    * hat-manager git repository - `<https://github.com/hat-open/hat-manager.git>`_
    * Hat Open homepage - `<https://hat-open.com>`_

.. warning::

    This project is currently in state of active development. Features,
    functionality and API are unstable.


About
-----

Manager is administration tool which enables communication with remote devices
and components. It can be used for testing various communication
protocols/equipment and monitoring/controlling other Hat components.
Usage of this tool is aimed at system administrators responsible for
maintaining Hat systems and configuring communication with 3rd party devices.

Supported communication:

    * IEC 60870-5-104 Master
    * IEC 60870-5-104 Slave
    * Modbus Master
    * Modbus Slave
    * Hat Orchestrator
    * Hat Monitor Server
    * Hat Event Server


Install
-------

::

    $ pip install hat-manager


Running
-------

By installing Manager from `hat-manager` package, executable `hat-manager`
becomes available and can be used for starting this component.

If previous configuration could not be found, Manager is started with default
configuration and front-end available at ``http://127.0.0.1:23024``.

All configuration parameters can be modified through front-end GUI.


License
-------

Copyright 2020-2021 Hat Open AUTHORS

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
