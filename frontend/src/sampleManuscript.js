// A short synthetic paper with deliberate formatting problems, so the report
// and the refinement flow have something to show. The work it describes is
// made up.
export const SAMPLE_MANUSCRIPT = `Edge-Side Anomaly Detection for Low-Power Sensor Networks Using Sliding-Window Autoencoders

Meera Kulkarni, Daniel Okafor, and Lin Wei
Department of Computer Engineering, Example University, Pune, India
{mkulkarni,lwei}@example.edu, d.okafor@example.org

Abstract. Wireless sensor networks deployed in factories, farms and buildings produce continuous streams of readings, and a small fraction of those readings signal faults that operators need to know about quickly. Most anomaly detectors for such streams run in the cloud, which means every reading has to be transmitted before it can be scored, and that transmission dominates the energy budget of a battery-powered node. In this paper we present a detector that runs on the sensor node itself. The detector is a compact autoencoder trained on sliding windows of recent readings, and it flags a window as anomalous when the reconstruction error exceeds a threshold that adapts to the recent error distribution. We describe how the model is quantized to 8-bit weights so that it fits in 64 kB of flash memory, and how the window length and stride are chosen to balance detection delay against computation. We evaluate the detector on two public datasets and on a 14-week deployment of 36 nodes in a commercial greenhouse. On the public datasets the detector reaches an F1 score of 0.91, compared with 0.93 for a cloud-hosted long short-term memory (LSTM) baseline that is roughly 40 times larger. In the greenhouse deployment the detector reduced radio transmissions by 72% because only windows flagged as anomalous were sent upstream, and the median node lifetime increased from 9 to 21 weeks. We also report the cases where the detector fails, in particular slow drifts that stay inside the adaptive threshold, and we discuss how a periodic recalibration step can address them. The results suggest that useful anomaly detection is possible within the memory and energy limits of commodity sensor hardware, and that moving detection to the edge changes the energy profile of the whole network.

Keywords: anomaly detection, wireless sensor networks, edge computing, autoencoders, model quantization, time series, energy efficiency, greenhouse monitoring

1 Introduction

Sensor networks are now cheap enough that a single site can run hundreds of nodes [1]. The readings they produce are mostly unremarkable, but operators can't afford to miss the few that indicate a failing pump or a blocked vent. A lot of existing systems forward every reading to a server and run detection there [2, 3]. That design is simple, but it's expensive in energy: on the hardware we use, the radio draws about 20 times more current than the microcontroller.

This paper asks whether detection can move onto the node. If a node can decide locally that a window of readings is normal, it doesn't need to transmit that window at all. The difficulty is that typical nodes have a few hundred kilobytes of memory and no floating-point unit, so models designed for servers won't run on them.

We make three contributions. First, we describe a sliding-window autoencoder small enough for a microcontroller. Second, we give an adaptive thresholding rule that needs no labelled anomalies. Third, we report results from a 14-week deployment rather than from simulation alone.

2 Related Work

Cloud-side detectors based on recurrent networks are accurate but large [2]. Statistical methods such as exponentially weighted moving averages are small enough for a node, yet they handle multivariate readings poorly [4]. Recent work compresses neural detectors with pruning and quantization [5], although most of it targets phones rather than microcontrollers. Protocol-level approaches reduce traffic by batching MQTT messages [6], which lowers overhead per reading but still transmits all of them.

3 Method

3.1 Sliding-Window Autoencoder

Each node keeps the most recent 32 readings from its 4 sensors in a ring buffer. Every 8 readings, the buffer is flattened into a 128-value vector and passed through an autoencoder with a 16-unit bottleneck. The reconstruction error is the mean squared difference between input and output.

3.2 Adaptive Threshold

A window is flagged when its error exceeds the mean plus 3 standard deviations of the errors seen over the previous 24 hours. The statistics are updated incrementally, so the node stores two running sums instead of a history.

3.2.1 Quantization

Weights are quantized to 8 bits after training. The quantized model occupies 41 kB of flash.

Figure 1: Structure of the on-node detector and the data path to the gateway.

4 Evaluation

Table 1. Detection quality and model size on the public datasets.

We compare against the LSTM baseline of [2] and a moving-average detector [4]. The autoencoder reaches an F1 score of 0.91, the LSTM baseline 0.93 and the moving average 0.74. It's worth noting that the LSTM model needs 1.7 MB and can't be deployed on the node.

In the greenhouse, 36 nodes ran for 14 weeks. Radio transmissions fell by 72% relative to a forward-everything configuration, and median node lifetime rose from 9 to 21 weeks. The detector missed 3 of 19 confirmed faults; all 3 were slow humidity drifts.

5 Conclusion

A quantized autoencoder running on the sensor node detects most faults while transmitting far less data. Slow drifts remain a weakness, and periodic recalibration of the threshold is the next step we plan to evaluate.

6 Acknowledgements

We thank the greenhouse operators for access to their site.

References

1. Akyildiz, I.F., Su, W., Sankarasubramaniam, Y., Cayirci, E.: Wireless sensor networks: a survey. Comput. Netw. 38(4), 393–422 (2002)
2. Malhotra, P., Vig, L., Shroff, G., Agarwal, P.: Long short term memory networks for anomaly detection in time series. In: ESANN 2015, pp. 89–94 (2015)
3. Chandola, V., Banerjee, A., Kumar, V.: Anomaly detection: a survey. ACM Comput. Surv. 41(3), 1–58 (2009)
4. Roberts, S.W.: Control chart tests based on geometric moving averages. Technometrics 1(3), 239–250 (1959)
5. Han, S., Mao, H., Dally, W.J.: Deep compression: compressing deep neural networks with pruning, trained quantization and Huffman coding. In: ICLR 2016 (2016)
6. Banks, A., Gupta, R. (eds.): MQTT Version 3.1.1. OASIS Standard (2014)
`;
